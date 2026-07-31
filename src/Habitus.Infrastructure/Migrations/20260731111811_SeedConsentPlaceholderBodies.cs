using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habitus.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SeedConsentPlaceholderBodies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent placeholder body seeding, targeted by Id. Version/Title/IsMandatory/
            // IsActive are left untouched so no re-consent is forced.
            migrationBuilder.Sql(""""
UPDATE "ConsentDefinitions"
SET "Body" = '> RASCUNHO — este texto é um modelo-base e requer revisão jurídica antes de produção.

# Termos de Utilização

## 1. Objeto
Os presentes Termos regulam o acesso e a utilização da plataforma Habitus de gestão de condomínios ("Plataforma") pelos seus utilizadores.

## 2. Conta e acesso
O utilizador é responsável por manter a confidencialidade das suas credenciais e por toda a atividade realizada na sua conta.

## 3. Utilização aceitável
O utilizador compromete-se a utilizar a Plataforma de acordo com a lei aplicável e a não praticar atos que prejudiquem o serviço ou terceiros.

## 4. Conteúdos
Os conteúdos submetidos pelo utilizador permanecem da sua responsabilidade. A Plataforma pode remover conteúdos que violem estes Termos.

## 5. Responsabilidade
A Plataforma é disponibilizada "tal como está", sendo a responsabilidade limitada nos termos da lei aplicável.

## 6. Alterações
Estes Termos podem ser atualizados. As alterações materiais serão comunicadas e poderão exigir nova aceitação.

## 7. Contactos
Para questões relativas a estes Termos, contacte o gestor do seu condomínio.'
WHERE "Id" = '11111111-1111-1111-1111-111111111111';
"""");

            migrationBuilder.Sql(""""
UPDATE "ConsentDefinitions"
SET "Body" = '> RASCUNHO — este texto é um modelo-base e requer revisão jurídica antes de produção.

# Política de Privacidade

## 1. Responsável pelo tratamento
O tratamento de dados pessoais é efetuado no âmbito da gestão do condomínio, nos termos do RGPD (Regulamento (UE) 2016/679).

## 2. Dados tratados
São tratados dados de identificação e contacto (nome, email, telefone) e dados necessários à gestão condominial.

## 3. Finalidades e fundamento
Os dados são tratados para a prestação do serviço, o cumprimento de obrigações legais e a gestão da relação com o utilizador.

## 4. Conservação
Os dados são conservados pelo período necessário às finalidades e às obrigações legais aplicáveis (por exemplo, a retenção de registos financeiros).

## 5. Direitos do titular
O titular pode exercer os direitos de acesso, retificação, apagamento, portabilidade e oposição, incluindo a exportação e o apagamento dos seus dados na área "Privacidade" do perfil.

## 6. Segurança
São aplicadas medidas técnicas e organizativas adequadas, incluindo a cifragem de dados sensíveis.

## 7. Contactos
Para exercer os seus direitos ou esclarecer dúvidas, contacte o gestor do seu condomínio.'
WHERE "Id" = '22222222-2222-2222-2222-222222222222';
"""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
UPDATE "ConsentDefinitions"
SET "Body" = NULL
WHERE "Id" IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
""");
        }
    }
}
