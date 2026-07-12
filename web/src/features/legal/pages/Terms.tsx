import { useTranslation } from 'react-i18next'
import LegalPageShell from '@/features/legal/components/LegalPageShell'
import ContactCard from '@/features/legal/components/ContactCard'
import { OPERATOR_JURISDICTION } from '@/features/legal/constants'

export default function Terms() {
  const { i18n } = useTranslation()
  const locale = (i18n.resolvedLanguage || i18n.language || '').toLowerCase()
  const isFrench = locale.startsWith('fr')

  return (
    <LegalPageShell
      title={isFrench ? "Conditions d'utilisation" : 'Terms of Service'}
      updated={isFrench ? 'Dernière mise à jour : 10 juillet 2026' : 'Last updated: July 10, 2026'}
    >
      {isFrench ? <TermsFr /> : <TermsEn />}
    </LegalPageShell>
  )
}

function TermsEn() {
  return (
    <>
      <p className="legal-doc__note">
        Portfolium is open-source, self-hosted software. There is no central company operating a
        shared Portfolium service on your behalf. When you use this application, you are using an
        instance deployed and administered by an <strong>operator</strong> — that may be yourself,
        your organization, or a third party who installed and runs the software you are accessing.
        These Terms govern your use of that instance. The operator is responsible for completing
        the contact, jurisdiction, and deployment-specific sections below.
      </p>

      <h2>1. Acceptance of these Terms</h2>
      <p>
        By creating an account or otherwise accessing this Portfolium instance, you agree to these
        Terms of Service. If you do not agree, do not create an account or use the service.
      </p>

      <h2>2. What Portfolium is</h2>
      <p>
        Portfolium is a portfolio-tracking application that lets you record holdings and
        transactions, manage watchlists and boards, view profit-and-loss analytics, charts,
        allocation breakdowns, and insights, and optionally share a read-only, percentage-based
        snapshot of a portfolio through a public link.
      </p>
      <p>
        Market prices, fundamentals, logos, reference data and related information are retrieved
        from third-party data providers, such as Yahoo Finance or similar providers. This data may
        be delayed, incomplete, unavailable or inaccurate.
      </p>

      <h2>3. No brokerage, custody, or order execution</h2>
      <p>
        Portfolium is not a broker, bank, investment adviser, custodian, exchange, trading venue or
        tax adviser. The application does not hold your money or securities, does not execute
        orders, and does not provide brokerage or custody services.
      </p>

      <h2>4. Not financial advice</h2>
      <p>
        Portfolium is a record-keeping and analytics tool. Nothing displayed in the application —
        including valuations, performance figures, allocation breakdowns, research, charts,
        watchlists, boards, market movers, or insights — is financial, investment, tax, accounting
        or legal advice. It should not be relied upon as the basis for any investment decision.
      </p>
      <p>
        You are solely responsible for your own investment decisions and for verifying the accuracy,
        completeness and relevance of any data before acting on it.
      </p>

      <h2>5. Your account</h2>
      <p>
        You are responsible for maintaining the confidentiality of your password and for all
        activity that occurs under your account. Notify the operator promptly if you suspect
        unauthorized access to your account. You must provide accurate information when registering
        and keep it up to date.
      </p>

      <h2>6. Data you enter</h2>
      <p>
        You are responsible for the accuracy and legality of the data you enter into Portfolium,
        including portfolio records, transactions, watchlists, notes, saved boards, layout
        preferences, and any content you choose to make available through a public sharing link. Do
        not use the service to store or share data you do not have the right to store or share.
      </p>

      <h2>7. Public sharing</h2>
      <p>
        If you enable public sharing for a portfolio, anyone with the generated link may be able to
        view the allocation percentages and top-holdings breakdown for that portfolio, whether or
        not they have an account. By default, public sharing is intended to exclude absolute
        monetary amounts, quantities and cost basis. The exact behavior may depend on the version
        and configuration of the instance you are using.
      </p>
      <p>
        You control whether sharing is enabled and can disable it at any time. The operator is not
        responsible for information you choose to disclose through a link you create and distribute
        yourself.
      </p>

      <h2>8. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          Attempt to gain unauthorized access to the instance, other accounts, or the underlying
          infrastructure.
        </li>
        <li>
          Interfere with or disrupt the service, including through excessive automated requests,
          scraping, abuse of API endpoints, or attempts to bypass rate limits.
        </li>
        <li>
          Use the service for any unlawful purpose or in violation of the operator’s acceptable-use
          rules, if any.
        </li>
        <li>
          Upload, store, or share content that infringes third-party rights or violates applicable
          law.
        </li>
        <li>
          Reverse engineer the hosted service beyond what is permitted by the software’s
          open-source license and applicable law.
        </li>
      </ul>

      <h2>9. Third-party data and services</h2>
      <p>
        Portfolium may rely on third-party providers for market data, logos, reference data, and,
        if configured by the operator, outbound email delivery for account verification, password
        resets, and notifications. These providers have their own terms, availability, limitations
        and data practices. The operator does not guarantee the accuracy, completeness or uptime of
        third-party data or services.
      </p>

      <h2>10. Availability and changes</h2>
      <p>
        The service is provided on an “as available” basis. The operator may modify, suspend, or
        discontinue the instance, or these Terms, at any time. Because Portfolium is self-hosted,
        the operator also determines backup, retention, maintenance and uptime practices for their
        deployment.
      </p>

      <h2>11. Open-source license and hosted service terms</h2>
      <p>
        Portfolium’s source code is distributed under its open-source license. That license governs
        your rights to use, copy, modify and distribute the software code. These Terms govern your
        use of a deployed Portfolium instance operated by the operator. The two are separate: using
        the source code under the open-source license does not necessarily grant you access to a
        specific hosted instance.
      </p>

      <h2>12. Disclaimer of warranties</h2>
      <p>
        To the fullest extent permitted by law, the software and service are provided “as is” and
        “as available,” without warranties of any kind. The operator and Portfolium project
        contributors do not warrant that the service will be uninterrupted, secure, accurate,
        complete, or error-free.
      </p>

      <h2>13. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, the operator and Portfolium project contributors
        are not liable for any indirect, incidental, special, consequential or punitive damages
        arising from your use of the service, including losses resulting from investment decisions
        made using data displayed in the application, third-party data errors, service
        interruptions, data loss, or unauthorized access.
      </p>

      <h2>14. Termination</h2>
      <p>
        You may stop using the service and request deletion of your account at any time. The
        operator may suspend or terminate accounts that violate these Terms, create security risk,
        abuse the service, or violate applicable law.
      </p>

      <h2>15. Privacy and data protection</h2>
      <p>
        The processing of personal data is described in the Privacy Policy for this instance. That
        policy explains what data may be collected, how it is used, how long it may be retained,
        and how to contact the operator about privacy and data requests.
      </p>

      <h2>16. Governing law</h2>
      <p>{OPERATOR_JURISDICTION.en}</p>

      <h2>17. Contact</h2>
      <ContactCard contactLabel="Questions about these Terms" sourceLabel="Source code & issue tracker" />
    </>
  )
}

function TermsFr() {
  return (
    <>
      <p className="legal-doc__note">
        Portfolium est un logiciel open-source et auto-hébergé. Aucune société centrale n’exploite
        un service Portfolium partagé en votre nom. Lorsque vous utilisez cette application, vous
        utilisez une instance déployée et administrée par un <strong>opérateur</strong> — qui peut
        être vous-même, votre organisation, ou un tiers ayant installé et exploitant le logiciel
        auquel vous accédez. Les présentes conditions régissent votre utilisation de cette instance.
        Il appartient à l’opérateur de compléter ci-dessous les informations de contact, de
        juridiction et les informations propres à son déploiement.
      </p>

      <h2>1. Acceptation des présentes conditions</h2>
      <p>
        En créant un compte ou en accédant autrement à cette instance de Portfolium, vous acceptez
        les présentes conditions d’utilisation. Si vous n’êtes pas d’accord, ne créez pas de compte
        et n’utilisez pas le service.
      </p>

      <h2>2. Ce qu’est Portfolium</h2>
      <p>
        Portfolium est une application de suivi de portefeuille permettant d’enregistrer des
        positions et des transactions, de gérer des watchlists et des boards, de consulter des
        analyses de plus-values, des graphiques, des répartitions d’allocation et des insights, et
        de partager, si vous le souhaitez, un aperçu en lecture seule et exprimé principalement en
        pourcentages via un lien public.
      </p>
      <p>
        Les cours, données fondamentales, logos, données de référence et informations associées
        proviennent de fournisseurs tiers, par exemple Yahoo Finance ou des fournisseurs
        similaires. Ces données peuvent être retardées, incomplètes, indisponibles ou inexactes.
      </p>

      <h2>3. Absence de courtage, conservation ou exécution d’ordres</h2>
      <p>
        Portfolium n’est pas un courtier, une banque, un conseiller en investissement, un
        dépositaire, une plateforme de négociation ou un conseiller fiscal. L’application ne détient
        pas votre argent ni vos titres, n’exécute pas d’ordres et ne fournit pas de services de
        courtage ou de conservation.
      </p>

      <h2>4. Absence de conseil financier</h2>
      <p>
        Portfolium est un outil de tenue de registres et d’analyse. Rien de ce qui est affiché dans
        l’application — valorisations, indicateurs de performance, répartitions d’allocation,
        recherche, graphiques, watchlists, boards, mouvements de marché ou insights — ne constitue
        un conseil financier, d’investissement, fiscal, comptable ou juridique, et ne doit pas
        servir de fondement à une décision d’investissement.
      </p>
      <p>
        Vous êtes seul responsable de vos décisions d’investissement et de la vérification de
        l’exactitude, de l’exhaustivité et de la pertinence des données avant d’agir sur leur base.
      </p>

      <h2>5. Votre compte</h2>
      <p>
        Vous êtes responsable de la confidentialité de votre mot de passe et de toute activité
        effectuée depuis votre compte. Prévenez rapidement l’opérateur si vous soupçonnez un accès
        non autorisé à votre compte. Vous devez fournir des informations exactes lors de
        l’inscription et les tenir à jour.
      </p>

      <h2>6. Données que vous saisissez</h2>
      <p>
        Vous êtes responsable de l’exactitude et de la licéité des données que vous saisissez dans
        Portfolium, y compris les portefeuilles, transactions, watchlists, notes, boards
        sauvegardés, préférences de mise en page et tout contenu que vous choisissez de rendre
        accessible via un lien de partage public. N’utilisez pas le service pour stocker ou partager
        des données que vous n’avez pas le droit de stocker ou de partager.
      </p>

      <h2>7. Partage public</h2>
      <p>
        Si vous activez le partage public d’un portefeuille, toute personne disposant du lien généré
        peut consulter la répartition en pourcentages et le tableau des principales positions de ce
        portefeuille, qu’elle dispose ou non d’un compte. Par défaut, le partage public est conçu
        pour exclure les montants absolus, les quantités et les prix de revient. Le comportement
        exact peut dépendre de la version et de la configuration de l’instance que vous utilisez.
      </p>
      <p>
        Vous contrôlez l’activation du partage et pouvez le désactiver à tout moment. L’opérateur
        n’est pas responsable des informations que vous choisissez de divulguer via un lien que vous
        créez et diffusez vous-même.
      </p>

      <h2>8. Utilisation acceptable</h2>
      <p>Vous vous engagez à ne pas :</p>
      <ul>
        <li>
          Tenter d’accéder sans autorisation à l’instance, à d’autres comptes ou à l’infrastructure
          sous-jacente.
        </li>
        <li>
          Perturber le service, notamment par des requêtes automatisées excessives, du scraping, un
          abus des endpoints API ou des tentatives de contournement des limites de débit.
        </li>
        <li>
          Utiliser le service à des fins illégales ou en violation des règles d’utilisation de
          l’opérateur, le cas échéant.
        </li>
        <li>
          Importer, stocker ou partager du contenu portant atteinte aux droits de tiers ou violant
          la loi applicable.
        </li>
        <li>
          Effectuer une ingénierie inverse du service hébergé au-delà de ce qu’autorisent la licence
          open-source du logiciel et la loi applicable.
        </li>
      </ul>

      <h2>9. Données et services tiers</h2>
      <p>
        Portfolium peut s’appuyer sur des fournisseurs tiers pour les données de marché, les logos,
        les données de référence et, si l’opérateur l’a configuré, l’envoi d’e-mails de vérification
        de compte, de réinitialisation de mot de passe et de notification. Ces fournisseurs ont
        leurs propres conditions, disponibilités, limitations et pratiques de traitement des
        données. L’opérateur ne garantit pas l’exactitude, l’exhaustivité ou la disponibilité des
        données ou services tiers.
      </p>

      <h2>10. Disponibilité et modifications</h2>
      <p>
        Le service est fourni selon sa disponibilité. L’opérateur peut modifier, suspendre ou
        interrompre l’instance, ou modifier les présentes conditions, à tout moment. Portfolium
        étant auto-hébergé, l’opérateur détermine également les pratiques de sauvegarde, de
        conservation, de maintenance et de disponibilité de son déploiement.
      </p>

      <h2>11. Licence open-source et conditions du service hébergé</h2>
      <p>
        Le code source de Portfolium est distribué sous sa licence open-source. Cette licence régit
        vos droits d’utiliser, copier, modifier et distribuer le code du logiciel. Les présentes
        conditions régissent votre utilisation d’une instance Portfolium déployée et exploitée par
        l’opérateur. Ces deux éléments sont distincts : l’utilisation du code source dans le cadre
        de la licence open-source ne vous donne pas nécessairement accès à une instance hébergée
        spécifique.
      </p>

      <h2>12. Absence de garantie</h2>
      <p>
        Dans toute la mesure permise par la loi, le logiciel et le service sont fournis « tels
        quels » et « selon disponibilité », sans garantie d’aucune sorte. L’opérateur et les
        contributeurs du projet Portfolium ne garantissent pas que le service sera ininterrompu,
        sécurisé, exact, complet ou exempt d’erreurs.
      </p>

      <h2>13. Limitation de responsabilité</h2>
      <p>
        Dans toute la mesure permise par la loi, l’opérateur et les contributeurs du projet
        Portfolium ne sont pas responsables des dommages indirects, accessoires, spéciaux,
        consécutifs ou punitifs résultant de votre utilisation du service, y compris les pertes
        résultant de décisions d’investissement prises à partir des données affichées dans
        l’application, d’erreurs de données tierces, d’interruptions du service, de pertes de
        données ou d’accès non autorisés.
      </p>

      <h2>14. Résiliation</h2>
      <p>
        Vous pouvez cesser d’utiliser le service et demander la suppression de votre compte à tout
        moment. L’opérateur peut suspendre ou résilier les comptes qui enfreignent les présentes
        conditions, créent un risque de sécurité, abusent du service ou violent la loi applicable.
      </p>

      <h2>15. Confidentialité et protection des données</h2>
      <p>
        Le traitement des données personnelles est décrit dans la politique de confidentialité de
        cette instance. Cette politique explique quelles données peuvent être collectées, comment
        elles sont utilisées, combien de temps elles peuvent être conservées et comment contacter
        l’opérateur pour les questions relatives à la confidentialité et aux données.
      </p>

      <h2>16. Droit applicable</h2>
      <p>{OPERATOR_JURISDICTION.fr}</p>

      <h2>17. Contact</h2>
      <ContactCard
        contactLabel="Questions sur ces conditions"
        sourceLabel="Code source & suivi des problèmes"
      />
    </>
  )
}