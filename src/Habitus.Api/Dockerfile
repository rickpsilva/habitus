FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgssapi-krb5-2 \
    && rm -rf /var/lib/apt/lists/*
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["Habitus.Api/Habitus.Api.csproj", "Habitus.Api/"]
COPY ["Habitus.Application/Habitus.Application.csproj", "Habitus.Application/"]
COPY ["Habitus.Domain/Habitus.Domain.csproj", "Habitus.Domain/"]
COPY ["Habitus.Infrastructure/Habitus.Infrastructure.csproj", "Habitus.Infrastructure/"]
RUN dotnet restore "Habitus.Api/Habitus.Api.csproj"
COPY . .
WORKDIR "/src/Habitus.Api"
RUN dotnet build "Habitus.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Habitus.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Habitus.Api.dll"]
