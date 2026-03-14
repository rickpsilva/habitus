using System.Security.Claims;
using Habitus.Application.DTOs.Common;
using Habitus.Application.Helpers;
using Habitus.Application.Interfaces;
using Habitus.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Habitus.Api.Controllers;

[ApiController]
[Route("api/documents")]
[Authorize]
public class DocumentsController : ControllerBase
{
    private readonly IRepository<Document> _repository;
    private readonly IRepository<User> _userRepository;
    private readonly IRepository<MaintenanceRequest> _maintenanceRepository;
    private readonly IBlobStorageService _blobStorage;

    public DocumentsController(
        IRepository<Document> repository,
        IRepository<User> userRepository,
        IRepository<MaintenanceRequest> maintenanceRepository,
        IBlobStorageService blobStorage)
    {
        _repository = repository;
        _userRepository = userRepository;
        _maintenanceRepository = maintenanceRepository;
        _blobStorage = blobStorage;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "");
        var user = await _userRepository.GetByIdAsync(userId);

        if (user == null) return Unauthorized();

        // Admin sees all documents
        if (user.Role == UserRole.Admin)
        {
            var allDocuments = await _repository.GetAllAsync();
            var dtos = allDocuments.Select(d => new
            {
                id = d.Id.ToString(),
                name = d.Name,
                type = d.Type.ToString(),
                context = d.Context.ToString(),
                description = d.Description,
                filePath = d.FilePath,
                fileSize = d.FileSize,
                mimeType = d.MimeType,
                uploadedAt = d.UploadedAt,
                uploadedBy = d.UploadedByUserId.ToString(),
                condominiumId = d.CondominiumId.ToString(),
                unitId = d.UnitId?.ToString(),
                assemblyId = d.AssemblyId?.ToString(),
                maintenanceRequestId = d.MaintenanceRequestId?.ToString(),
                year = d.Year
            });
            return Ok(dtos);
        }

        // Resident sees condominium, assembly, maintenance, financial, and their own unit documents
        var userMaintenanceIds = (await _maintenanceRepository.GetAllAsync())
            .Where(m => m.UnitId == user.UnitId)
            .Select(m => m.Id)
            .ToList();

        var documents = (await _repository.GetAllAsync())
            .Where(d =>
                (d.Context == DocumentContext.Condominium && d.CondominiumId == user.CondominiumId) ||
                (d.Context == DocumentContext.Assembly && d.CondominiumId == user.CondominiumId) ||
                (d.Context == DocumentContext.Unit && d.UnitId == user.UnitId) ||
                (d.Context == DocumentContext.Maintenance && d.MaintenanceRequestId.HasValue && userMaintenanceIds.Contains(d.MaintenanceRequestId.Value)) ||
                (d.Context == DocumentContext.Financial && d.CondominiumId == user.CondominiumId))
            .Select(d => new
            {
                id = d.Id.ToString(),
                name = d.Name,
                type = d.Type.ToString(),
                context = d.Context.ToString(),
                description = d.Description,
                filePath = d.FilePath,
                fileSize = d.FileSize,
                mimeType = d.MimeType,
                uploadedAt = d.UploadedAt,
                uploadedBy = d.UploadedByUserId.ToString(),
                condominiumId = d.CondominiumId.ToString(),
                unitId = d.UnitId?.ToString(),
                assemblyId = d.AssemblyId?.ToString(),
                maintenanceRequestId = d.MaintenanceRequestId?.ToString(),
                year = d.Year
            })
            .ToList();

        return Ok(documents);
    }

    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        [FromQuery] DocumentContext? context = null)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;

        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "");
        var user = await _userRepository.GetByIdAsync(userId);

        if (user == null) return Unauthorized();

        var documents = await _repository.GetAllAsync();

        // Filter by context if specified
        if (context.HasValue)
        {
            documents = documents.Where(d => d.Context == context.Value).ToList();
        }

        // Apply security filters
        if (user.Role != UserRole.Admin)
        {
            // Get maintenance requests from user's unit to check access
            var userMaintenanceIds = (await _maintenanceRepository.GetAllAsync())
                .Where(m => m.UnitId == user.UnitId)
                .Select(m => m.Id)
                .ToList();

            // Residents can see their own unit documents, but not other units
            documents = documents
                .Where(d =>
                    (d.Context == DocumentContext.Condominium && d.CondominiumId == user.CondominiumId) ||
                    (d.Context == DocumentContext.Assembly && d.CondominiumId == user.CondominiumId) ||
                    (d.Context == DocumentContext.Unit && d.UnitId == user.UnitId) ||
                    (d.Context == DocumentContext.Maintenance && d.MaintenanceRequestId.HasValue && userMaintenanceIds.Contains(d.MaintenanceRequestId.Value)) ||
                    (d.Context == DocumentContext.Financial && d.CondominiumId == user.CondominiumId))
                .ToList();
        }
        else
        {
            // Admin only sees documents from their condominium
            documents = documents.Where(d => d.CondominiumId == user.CondominiumId).ToList();
        }

        var ordered = documents.OrderByDescending(d => d.UploadedAt).AsEnumerable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            ordered = ordered.Where(d =>
                d.Name.ToLower().Contains(searchLower) ||
                d.Type.ToString().ToLower().Contains(searchLower) ||
                (d.Description != null && d.Description.ToLower().Contains(searchLower))
            );
        }

        // Map to DTOs to avoid circular references
        var dtos = ordered.Select(d => new
        {
            id = d.Id.ToString(),
            name = d.Name,
            type = d.Type.ToString(),
            context = d.Context.ToString(),
            description = d.Description,
            filePath = d.FilePath,
            fileSize = d.FileSize,
            mimeType = d.MimeType,
            uploadedAt = d.UploadedAt,
            uploadedBy = d.UploadedByUserId.ToString(),
            condominiumId = d.CondominiumId.ToString(),
            unitId = d.UnitId?.ToString(),
            assemblyId = d.AssemblyId?.ToString(),
            maintenanceRequestId = d.MaintenanceRequestId?.ToString(),
            year = d.Year
        });

        return Ok(PaginationHelper.Paginate(dtos, page, pageSize));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var document = await _repository.GetByIdAsync(id);
        if (document == null) return NotFound();

        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "");
        var user = await _userRepository.GetByIdAsync(userId);

        if (user == null) return Unauthorized();

        // Check permissions
        if (user.Role != UserRole.Admin)
        {
            // Residents can only access their own unit documents
            if (document.Context == DocumentContext.Unit && document.UnitId != user.UnitId)
            {
                return Forbid();
            }

            // For maintenance documents, check if the maintenance belongs to user's unit
            if (document.Context == DocumentContext.Maintenance)
            {
                if (!document.MaintenanceRequestId.HasValue)
                {
                    return Forbid();
                }

                var maintenance = await _maintenanceRepository.GetByIdAsync(document.MaintenanceRequestId.Value);
                if (maintenance == null || maintenance.UnitId != user.UnitId)
                {
                    return Forbid();
                }
            }

            if (document.CondominiumId != user.CondominiumId)
            {
                return Forbid();
            }
        }

        var dto = new
        {
            id = document.Id.ToString(),
            name = document.Name,
            type = document.Type.ToString(),
            context = document.Context.ToString(),
            description = document.Description,
            filePath = document.FilePath,
            fileSize = document.FileSize,
            mimeType = document.MimeType,
            uploadedAt = document.UploadedAt,
            uploadedBy = document.UploadedByUserId.ToString(),
            condominiumId = document.CondominiumId.ToString(),
            unitId = document.UnitId?.ToString(),
            assemblyId = document.AssemblyId?.ToString(),
            maintenanceRequestId = document.MaintenanceRequestId?.ToString(),
            year = document.Year
        };

        return Ok(dto);
    }

    [HttpGet("by-context/{context}")]
    public async Task<IActionResult> GetByContext(DocumentContext context)
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "");
        var user = await _userRepository.GetByIdAsync(userId);

        if (user == null) return Unauthorized();

        var documents = (await _repository.GetAllAsync())
            .Where(d => d.Context == context && d.CondominiumId == user.CondominiumId)
            .OrderByDescending(d => d.UploadedAt)
            .ToList();

        // Apply security filters for residents
        if (user.Role != UserRole.Admin)
        {
            // Get maintenance requests from user's unit
            var userMaintenanceIds = (await _maintenanceRepository.GetAllAsync())
                .Where(m => m.UnitId == user.UnitId)
                .Select(m => m.Id)
                .ToList();

            // Residents can see their own unit documents, but not other units
            documents = documents
                .Where(d =>
                    d.Context == DocumentContext.Condominium ||
                    d.Context == DocumentContext.Assembly ||
                    (d.Context == DocumentContext.Unit && d.UnitId == user.UnitId) ||
                    (d.Context == DocumentContext.Maintenance && d.MaintenanceRequestId.HasValue && userMaintenanceIds.Contains(d.MaintenanceRequestId.Value)) ||
                    d.Context == DocumentContext.Financial)
                .ToList();
        }

        var dtos = documents.Select(d => new
        {
            id = d.Id.ToString(),
            name = d.Name,
            type = d.Type.ToString(),
            context = d.Context.ToString(),
            description = d.Description,
            filePath = d.FilePath,
            fileSize = d.FileSize,
            mimeType = d.MimeType,
            uploadedAt = d.UploadedAt,
            uploadedBy = d.UploadedByUserId.ToString(),
            condominiumId = d.CondominiumId.ToString(),
            unitId = d.UnitId?.ToString(),
            assemblyId = d.AssemblyId?.ToString(),
            maintenanceRequestId = d.MaintenanceRequestId?.ToString(),
            year = d.Year
        });

        return Ok(dtos);
    }

    [HttpGet("unit/{unitId}")]
    public async Task<IActionResult> GetByUnit(Guid unitId)
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "");
        var user = await _userRepository.GetByIdAsync(userId);

        if (user == null) return Unauthorized();

        // Only admins can access unit documents
        if (user.Role != UserRole.Admin)
        {
            return Forbid();
        }

        var documents = (await _repository.GetAllAsync())
            .Where(d => d.Context == DocumentContext.Unit && d.UnitId == unitId)
            .OrderByDescending(d => d.UploadedAt)
            .Select(d => new
            {
                id = d.Id.ToString(),
                name = d.Name,
                type = d.Type.ToString(),
                context = d.Context.ToString(),
                description = d.Description,
                filePath = d.FilePath,
                fileSize = d.FileSize,
                mimeType = d.MimeType,
                uploadedAt = d.UploadedAt,
                uploadedBy = d.UploadedByUserId.ToString(),
                condominiumId = d.CondominiumId.ToString(),
                unitId = d.UnitId?.ToString(),
                assemblyId = d.AssemblyId?.ToString(),
                maintenanceRequestId = d.MaintenanceRequestId?.ToString(),
                year = d.Year
            })
            .ToList();

        return Ok(documents);
    }

    [HttpGet("assembly/{assemblyId}")]
    public async Task<IActionResult> GetByAssembly(Guid assemblyId)
    {
        var documents = (await _repository.GetAllAsync())
            .Where(d => d.Context == DocumentContext.Assembly && d.AssemblyId == assemblyId)
            .OrderByDescending(d => d.UploadedAt)
            .Select(d => new
            {
                id = d.Id.ToString(),
                name = d.Name,
                type = d.Type.ToString(),
                context = d.Context.ToString(),
                description = d.Description,
                filePath = d.FilePath,
                fileSize = d.FileSize,
                mimeType = d.MimeType,
                uploadedAt = d.UploadedAt,
                uploadedBy = d.UploadedByUserId.ToString(),
                condominiumId = d.CondominiumId.ToString(),
                unitId = d.UnitId?.ToString(),
                assemblyId = d.AssemblyId?.ToString(),
                maintenanceRequestId = d.MaintenanceRequestId?.ToString(),
                year = d.Year
            })
            .ToList();

        return Ok(documents);
    }

    [HttpGet("maintenance/{maintenanceRequestId}")]
    public async Task<IActionResult> GetByMaintenanceRequest(Guid maintenanceRequestId)
    {
        var documents = (await _repository.GetAllAsync())
            .Where(d => d.Context == DocumentContext.Maintenance && d.MaintenanceRequestId == maintenanceRequestId)
            .OrderByDescending(d => d.UploadedAt)
            .Select(d => new
            {
                id = d.Id.ToString(),
                name = d.Name,
                type = d.Type.ToString(),
                context = d.Context.ToString(),
                description = d.Description,
                filePath = d.FilePath,
                fileSize = d.FileSize,
                mimeType = d.MimeType,
                uploadedAt = d.UploadedAt,
                uploadedBy = d.UploadedByUserId.ToString(),
                condominiumId = d.CondominiumId.ToString(),
                unitId = d.UnitId?.ToString(),
                assemblyId = d.AssemblyId?.ToString(),
                maintenanceRequestId = d.MaintenanceRequestId?.ToString(),
                year = d.Year
            })
            .ToList();

        return Ok(documents);
    }

    [HttpPost("upload")]
    [RequestFormLimits(MultipartBodyLengthLimit = 104857600)] // 100 MB
    [RequestSizeLimit(104857600)] // 100 MB
    public async Task<IActionResult> Upload(
        [FromForm] IFormFile file,
        [FromForm] string name,
        [FromForm] string type,
        [FromForm] string context,
        [FromForm] string? description = null,
        [FromForm] string? unitId = null,
        [FromForm] string? assemblyId = null,
        [FromForm] string? maintenanceRequestId = null,
        [FromForm] int? year = null)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest("No file uploaded");
        }

        // Parse enums and GUIDs
        if (!Enum.TryParse<DocumentType>(type, out var documentType))
        {
            return BadRequest($"Invalid document type: {type}");
        }

        if (!Enum.TryParse<DocumentContext>(context, out var documentContext))
        {
            return BadRequest($"Invalid document context: {context}");
        }

        Guid? unitGuid = null;
        if (!string.IsNullOrEmpty(unitId) && Guid.TryParse(unitId, out var parsedUnitId))
        {
            unitGuid = parsedUnitId;
        }

        Guid? assemblyGuid = null;
        if (!string.IsNullOrEmpty(assemblyId) && Guid.TryParse(assemblyId, out var parsedAssemblyId))
        {
            assemblyGuid = parsedAssemblyId;
        }

        Guid? maintenanceGuid = null;
        if (!string.IsNullOrEmpty(maintenanceRequestId) && Guid.TryParse(maintenanceRequestId, out var parsedMaintenanceId))
        {
            maintenanceGuid = parsedMaintenanceId;
        }

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized("Invalid user credentials");
        }

        var user = await _userRepository.GetByIdAsync(userId);

        if (user == null) return Unauthorized();

        if (!user.CondominiumId.HasValue)
        {
            return BadRequest("User does not belong to a condominium");
        }

        // Validate context-specific IDs
        if (documentContext == DocumentContext.Unit && !unitGuid.HasValue)
        {
            return BadRequest("UnitId is required for Unit documents");
        }

        if (documentContext == DocumentContext.Assembly && !assemblyGuid.HasValue)
        {
            return BadRequest("AssemblyId is required for Assembly documents");
        }

        if (documentContext == DocumentContext.Maintenance && !maintenanceGuid.HasValue)
        {
            return BadRequest("MaintenanceRequestId is required for Maintenance documents");
        }

        if (documentContext == DocumentContext.Financial && !year.HasValue)
        {
            return BadRequest("Year is required for Financial documents");
        }

        // Check permissions
        if (user.Role != UserRole.Admin)
        {
            // Residents can upload documents to their own unit
            if (documentContext == DocumentContext.Unit && unitGuid != user.UnitId)
            {
                return Forbid();
            }

            // Only admin can upload Assembly, Maintenance, Condominium, and Financial documents
            if (documentContext != DocumentContext.Unit)
            {
                return Forbid();
            }
        }

        try
        {
            using var stream = file.OpenReadStream();
            var filePath = await _blobStorage.UploadAsync(stream, file.FileName, file.ContentType);

            var document = new Document
            {
                Id = Guid.NewGuid(),
                Name = name,
                Type = documentType,
                Context = documentContext,
                Description = description,
                FilePath = filePath,
                FileSize = file.Length,
                MimeType = file.ContentType,
                UploadedAt = DateTime.UtcNow,
                UploadedByUserId = userId,
                CondominiumId = user.CondominiumId.Value,
                UnitId = unitGuid,
                AssemblyId = assemblyGuid,
                MaintenanceRequestId = maintenanceGuid,
                Year = year
            };

            await _repository.AddAsync(document);
            await _repository.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { id = document.Id }, document);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error uploading file: {ex.Message}");
        }
    }

    [HttpPost("upload-multiple")]
    [RequestFormLimits(MultipartBodyLengthLimit = 524288000)] // 500 MB total
    [RequestSizeLimit(524288000)] // 500 MB total
    public async Task<IActionResult> UploadMultiple(
        [FromForm] List<IFormFile> files,
        [FromForm] string context,
        [FromForm] string? unitId = null,
        [FromForm] string? assemblyId = null,
        [FromForm] string? maintenanceRequestId = null,
        [FromForm] int? year = null)
    {
        try
        {
            if (files == null || files.Count == 0)
            {
                return BadRequest("No files uploaded");
            }

            // Limit number of files
            if (files.Count > 10)
            {
                return BadRequest("Maximum 10 files allowed per upload");
            }

            // Parse context
            if (!Enum.TryParse<DocumentContext>(context, out var documentContext))
            {
                return BadRequest($"Invalid document context: {context}");
            }

            Guid? unitGuid = null;
            if (!string.IsNullOrEmpty(unitId) && Guid.TryParse(unitId, out var parsedUnitId))
            {
                unitGuid = parsedUnitId;
            }

            Guid? assemblyGuid = null;
            if (!string.IsNullOrEmpty(assemblyId) && Guid.TryParse(assemblyId, out var parsedAssemblyId))
            {
                assemblyGuid = parsedAssemblyId;
            }

            Guid? maintenanceGuid = null;
            if (!string.IsNullOrEmpty(maintenanceRequestId) && Guid.TryParse(maintenanceRequestId, out var parsedMaintenanceId))
            {
                maintenanceGuid = parsedMaintenanceId;
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized("Invalid user credentials");
            }

            var user = await _userRepository.GetByIdAsync(userId);

            if (user == null) return Unauthorized();

            if (!user.CondominiumId.HasValue)
            {
                return BadRequest("User does not belong to a condominium");
            }

            // Validate context-specific IDs
            if (documentContext == DocumentContext.Unit && !unitGuid.HasValue)
            {
                return BadRequest("UnitId is required for Unit documents");
            }

            if (documentContext == DocumentContext.Assembly && !assemblyGuid.HasValue)
            {
                return BadRequest("AssemblyId is required for Assembly documents");
            }

            if (documentContext == DocumentContext.Maintenance && !maintenanceGuid.HasValue)
            {
                return BadRequest("MaintenanceRequestId is required for Maintenance documents");
            }

            if (documentContext == DocumentContext.Financial && !year.HasValue)
            {
                return BadRequest("Year is required for Financial documents");
            }

            // Check permissions
            if (user.Role != UserRole.Admin)
            {
                if (documentContext == DocumentContext.Unit && unitGuid != user.UnitId)
                {
                    return Forbid();
                }

                // Only admins can upload Assembly, Maintenance, Condominium, and Financial documents
                if (documentContext != DocumentContext.Unit)
                {
                    return Forbid();
                }
            }

            var uploadedDocuments = new List<Document>();
            var errors = new List<string>();

            foreach (var file in files)
            {
                if (file.Length == 0) continue;

                // Validate file size (100MB max per file)
                if (file.Length > 104857600)
                {
                    errors.Add($"{file.FileName}: File size exceeds 100MB");
                    continue;
                }

                // Auto-detect type based on filename
                DocumentType documentType = DocumentType.Other;
                var lowerName = file.FileName.ToLower();
                
                if (documentContext == DocumentContext.Assembly)
                {
                    if (lowerName.Contains("ata") || lowerName.Contains("minute"))
                        documentType = DocumentType.AssemblyMinutes;
                    else if (lowerName.Contains("convocatoria") || lowerName.Contains("convocation"))
                        documentType = DocumentType.AssemblyConvocation;
                    else
                        documentType = DocumentType.AssemblyAttachment;
                }
                else if (documentContext == DocumentContext.Unit)
                {
                    if (lowerName.Contains("seguro") || lowerName.Contains("insurance"))
                        documentType = DocumentType.UnitInsurance;
                    else if (lowerName.Contains("escritura") || lowerName.Contains("ownership"))
                        documentType = DocumentType.UnitOwnershipProof;
                    else
                        documentType = DocumentType.UnitOther;
                }
                else if (documentContext == DocumentContext.Maintenance)
                {
                    if (lowerName.Contains("fatura") || lowerName.Contains("invoice") || lowerName.Contains("recibo"))
                        documentType = DocumentType.MaintenanceInvoice;
                    else if (lowerName.Contains("orcamento") || lowerName.Contains("quote"))
                        documentType = DocumentType.MaintenanceQuote;
                    else
                        documentType = DocumentType.MaintenanceReport;
                }
                else if (documentContext == DocumentContext.Condominium)
                {
                    if (lowerName.Contains("regulamento") || lowerName.Contains("regulation"))
                        documentType = DocumentType.CondominiumRegulation;
                    else if (lowerName.Contains("seguro") || lowerName.Contains("insurance"))
                        documentType = DocumentType.CondominiumInsurance;
                    else if (lowerName.Contains("contrato") || lowerName.Contains("contract"))
                        documentType = DocumentType.CondominiumContract;
                }
                else if (documentContext == DocumentContext.Financial)
                {
                    if (lowerName.Contains("extrato") || lowerName.Contains("bank") || lowerName.Contains("statement"))
                        documentType = DocumentType.FinancialBankStatement;
                    else if (lowerName.Contains("relatorio") || lowerName.Contains("report") || lowerName.Contains("anual"))
                        documentType = DocumentType.FinancialAnnualReport;
                    else if (lowerName.Contains("orcamento") || lowerName.Contains("budget"))
                        documentType = DocumentType.FinancialBudget;
                    else if (lowerName.Contains("auditoria") || lowerName.Contains("audit"))
                        documentType = DocumentType.FinancialAudit;
                    else if (lowerName.Contains("fiscal") || lowerName.Contains("tax") || lowerName.Contains("irs") || lowerName.Contains("iva"))
                        documentType = DocumentType.FinancialTaxDocument;
                    else
                        documentType = DocumentType.FinancialOther;
                }

                try
                {
                    using var stream = file.OpenReadStream();
                    var filePath = await _blobStorage.UploadAsync(stream, file.FileName, file.ContentType);

                    var document = new Document
                    {
                        Id = Guid.NewGuid(),
                        Name = Path.GetFileNameWithoutExtension(file.FileName),
                        Type = documentType,
                        Context = documentContext,
                        FilePath = filePath,
                        FileSize = file.Length,
                        MimeType = file.ContentType,
                        UploadedAt = DateTime.UtcNow,
                        UploadedByUserId = userId,
                        CondominiumId = user.CondominiumId.Value,
                        UnitId = unitGuid,
                        AssemblyId = assemblyGuid,
                        MaintenanceRequestId = maintenanceGuid,
                        Year = year
                    };

                    await _repository.AddAsync(document);
                    uploadedDocuments.Add(document);
                }
                catch (Exception ex)
                {
                    errors.Add($"{file.FileName}: {ex.Message}");
                }
            }

            if (uploadedDocuments.Count > 0)
            {
                await _repository.SaveChangesAsync();
            }

            return Ok(new
            {
                success = uploadedDocuments.Count,
                failed = errors.Count,
                documents = uploadedDocuments,
                errors = errors
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error uploading documents: {ex.Message}");
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var document = await _repository.GetByIdAsync(id);
        if (document == null) return NotFound();

        try
        {
            // Delete file from storage
            await _blobStorage.DeleteAsync(document.FilePath);

            // Delete database record
            _repository.Remove(document);
            await _repository.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error deleting document: {ex.Message}");
        }
    }

    [HttpGet("{id}/download")]
    public async Task<IActionResult> Download(Guid id)
    {
        var document = await _repository.GetByIdAsync(id);
        if (document == null) return NotFound();

        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "");
        var user = await _userRepository.GetByIdAsync(userId);

        if (user == null) return Unauthorized();

        // Check permissions
        if (user.Role != UserRole.Admin)
        {
            // Residents can only access their own unit documents
            if (document.Context == DocumentContext.Unit && document.UnitId != user.UnitId)
            {
                return Forbid();
            }

            // For maintenance documents, check if the maintenance belongs to user's unit
            if (document.Context == DocumentContext.Maintenance)
            {
                if (!document.MaintenanceRequestId.HasValue)
                {
                    return Forbid();
                }

                var maintenance = await _maintenanceRepository.GetByIdAsync(document.MaintenanceRequestId.Value);
                if (maintenance == null || maintenance.UnitId != user.UnitId)
                {
                    return Forbid();
                }
            }

            if (document.CondominiumId != user.CondominiumId)
            {
                return Forbid();
            }
        }

        // For development with local files
        if (document.FilePath.StartsWith("/uploads/"))
        {
            var filePath = Path.Combine(Directory.GetCurrentDirectory(), document.FilePath.TrimStart('/'));

            if (!System.IO.File.Exists(filePath))
            {
                return NotFound("File not found on disk");
            }

            var fileBytes = await System.IO.File.ReadAllBytesAsync(filePath);
            return File(fileBytes, document.MimeType ?? "application/octet-stream", document.Name);
        }

        // For production with Azure Blob Storage URLs
        return Redirect(document.FilePath);
    }
}

