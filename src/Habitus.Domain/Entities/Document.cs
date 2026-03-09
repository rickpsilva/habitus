namespace Habitus.Domain.Entities;

public enum DocumentType
{
    // Documentos de Frações
    UnitInsurance,           // Seguro da fração
    UnitOwnershipProof,      // Escritura/Propriedade
    UnitOther,               // Outros docs da fração
    
    // Documentos de Assembleias
    AssemblyMinutes,         // Ata da assembleia
    AssemblyConvocation,     // Convocatória
    AssemblyAttachment,      // Anexo da assembleia
    
    // Documentos de Manutenção
    MaintenanceInvoice,      // Fatura/Recibo
    MaintenanceQuote,        // Orçamento
    MaintenanceReport,       // Relatório técnico
    
    // Documentos Financeiros
    FinancialBankStatement,  // Extrato bancário
    FinancialAnnualReport,   // Relatório anual
    FinancialBudget,         // Orçamento anual
    FinancialAudit,          // Auditoria
    FinancialTaxDocument,    // Documentos fiscais
    FinancialOther,          // Outros docs financeiros
    
    // Documentos Gerais
    CondominiumRegulation,   // Regulamento
    CondominiumInsurance,    // Seguro do condomínio
    CondominiumContract,     // Contratos
    Other
}

public enum DocumentContext
{
    Condominium,    // Documento geral do condomínio
    Unit,           // Documento de uma fração
    Assembly,       // Documento de assembleia
    Maintenance,    // Documento de manutenção
    Financial       // Documento financeiro
}

public class Document
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DocumentType Type { get; set; }
    public DocumentContext Context { get; set; }
    public string FilePath { get; set; } = string.Empty; // Path local ou URL (Azure Blob)
    public long FileSize { get; set; } // Em bytes
    public string MimeType { get; set; } = string.Empty; // application/pdf, image/jpeg, etc
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    public Guid UploadedByUserId { get; set; }
    public int? Year { get; set; } // Ano para documentos financeiros
    
    // Foreign Keys (nullable - depende do contexto)
    public Guid CondominiumId { get; set; }
    public Guid? UnitId { get; set; }           // Se for doc de fração
    public Guid? AssemblyId { get; set; }       // Se for doc de assembleia
    public Guid? MaintenanceRequestId { get; set; } // Se for doc de manutenção
    
    // Navigation properties
    public Condominium Condominium { get; set; } = null!;
    public Unit? Unit { get; set; }
    public Assembly? Assembly { get; set; }
    public MaintenanceRequest? MaintenanceRequest { get; set; }
    public User UploadedByUser { get; set; } = null!;
}
