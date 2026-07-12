import { useTranslation } from 'react-i18next'
import LegalPageShell from '@/features/legal/components/LegalPageShell'
import ContactCard from '@/features/legal/components/ContactCard'

export default function Privacy() {
  const { i18n } = useTranslation()
  const locale = (i18n.resolvedLanguage || i18n.language || '').toLowerCase()
  const isFrench = locale.startsWith('fr')

  return (
    <LegalPageShell
      title={isFrench ? 'Politique de confidentialité' : 'Privacy Policy'}
      updated={isFrench ? 'Dernière mise à jour : 10 juillet 2026' : 'Last updated: July 10, 2026'}
    >
      {isFrench ? <PrivacyFr /> : <PrivacyEn />}
    </LegalPageShell>
  )
}

function PrivacyEn() {
  return (
    <>
      <p className="legal-doc__note">
        Portfolium is open-source and self-hosted: your data is stored in the database of the
        specific instance you are using, operated by whoever deployed it (the{' '}
        <strong>operator</strong>) — not by a central Portfolium company. This policy describes
        what the Portfolium software itself collects and does with data by default. The operator
        of your instance is responsible for the contact details below and for any additional
        processing they configure.
      </p>

      <h2>1. What data Portfolium collects</h2>

      <h3>Account data</h3>
      <p>
        When you register, Portfolium stores your email address, username, a securely hashed
        password, and optionally a full name. If you enable two-factor authentication, it stores
        the associated 2FA secret.
      </p>

      <h3>Portfolio and transaction data</h3>
      <p>
        Portfolium stores the portfolios, holdings, watchlists, boards, saved layouts and
        transactions you create, along with derived analytics such as performance, allocation,
        insights and charts computed from that data.
      </p>

      <h3>Notification and calendar data</h3>
      <p>
        If you enable notifications, reports or calendar-related features, Portfolium stores your
        notification preferences and delivery history.
      </p>

      <h3>Technical data</h3>
      <p>
        Portfolium issues a session token, such as a JSON Web Token, on login. This token is stored
        in your browser’s local storage and is used to authenticate API requests to the instance
        you are using. The API and its underlying infrastructure may keep standard server logs,
        such as request timestamps, IP addresses, user agent information and error logs, for
        operational and security purposes. Retention of these logs is controlled by the operator.
      </p>

      <h2>2. What Portfolium does not do</h2>
      <p>
        The Portfolium application does not embed third-party advertising, analytics or cross-site
        tracking scripts by default. It does not sell or share your data with advertisers.
        Portfolium uses browser local storage only for strictly necessary authentication and
        session functionality, not for advertising or cross-site tracking.
      </p>

      <h2>3. Third-party data processors</h2>
      <p>
        Depending on how the operator has configured the instance, the following third parties may
        process limited data on the instance’s behalf:
      </p>

      <ul>
        <li>
          <strong>Market data providers</strong>, for example Yahoo Finance or similar providers,
          may supply prices, fundamentals, logos, reference data and market information used to
          power the app. Requests to these providers are generally made by the server and do not
          include your personal account password or private portfolio notes.
        </li>
        <li>
          <strong>Outbound email providers</strong>, if configured by the operator, may be used to
          deliver account verification, password reset and notification emails. This requires
          sending your email address and the relevant message content to that provider.
        </li>
        <li>
          <strong>Infrastructure providers</strong>, such as hosting, database, storage, monitoring
          or backup providers, may process data as necessary to operate the instance.
        </li>
      </ul>

      <h2>4. International transfers</h2>
      <p>
        Depending on the operator’s deployment and third-party providers, some processing may
        involve providers located outside your country or outside the European Economic Area. The
        operator is responsible for ensuring that appropriate safeguards are in place where
        required by applicable law.
      </p>

      <h2>5. Public portfolio sharing</h2>
      <p>
        If you turn on public sharing for a portfolio, Portfolium generates a link that lets
        anyone with the link view that portfolio’s sector and geographic allocation percentages
        and its top-holdings table, including symbol, name, country, sector, industry and weight.
        Absolute monetary amounts, quantities and cost basis are not exposed through a public link
        by default. No data is shared publicly for a portfolio unless you explicitly enable sharing
        for it. Disabling sharing invalidates the previous link.
      </p>

      <h2>6. How your data is used</h2>
      <p>Data you provide is used to:</p>

      <ul>
        <li>Operate your account and authenticate you.</li>
        <li>Calculate and display your portfolio analytics, charts, boards and insights.</li>
        <li>Store your watchlists, research history, saved layouts and preferences.</li>
        <li>Send account-related and, where enabled, notification emails.</li>
        <li>Maintain the security, reliability and integrity of the instance.</li>
      </ul>

      <p>
        Portfolium does not use your data to train machine learning models by default and does not
        use your data for advertising purposes.
      </p>

      <h2>7. Legal bases for processing</h2>
      <p>
        Depending on the feature and the operator’s configuration, personal data may be processed
        because it is necessary to provide the service, to secure the instance, to comply with legal
        obligations, or based on the operator’s legitimate interest in maintaining and improving the
        application. Where a feature requires consent under applicable law, the operator is
        responsible for collecting and managing that consent.
      </p>

      <h2>8. Data retention and deletion</h2>
      <p>
        Your data is retained for as long as your account exists on the instance, unless the
        operator defines a different retention period. You can request account and data deletion
        from the operator at any time. Because Portfolium is self-hosted software, the operator is
        responsible for carrying out deletion and for determining backup retention for their
        deployment.
      </p>

      <h2>9. Data security</h2>
      <p>
        Passwords are stored using a salted cryptographic hash, never in plain text. Optional
        two-factor authentication is available to further secure your account. The overall security
        of an instance, including transport encryption, infrastructure hardening, access controls
        and backups, depends on how the operator has deployed and maintained it.
      </p>

      <h2>10. Your rights</h2>
      <p>
        Depending on your jurisdiction, you may have rights to access, correct, export or delete
        your personal data, and to object to or restrict certain processing. You may also have the
        right to withdraw consent where processing is based on consent. To exercise these rights,
        contact the operator of your instance using the details below.
      </p>

      <p>
        You may also lodge a complaint with the competent data protection authority, including the
        CNIL if the instance is operated in France.
      </p>

      <h2>11. Children’s privacy</h2>
      <p>
        Portfolium is not directed at children, and account registration is not intended for
        individuals below the age of legal majority in their jurisdiction.
      </p>

      <h2>12. Changes to this policy</h2>
      <p>
        The operator may update this policy from time to time. Material changes will be reflected
        by updating the “last updated” date above.
      </p>

      <h2>13. Contact</h2>
      <ContactCard
        contactLabel="Privacy questions & data requests"
        sourceLabel="Source code & data handling"
      />
    </>
  )
}

function PrivacyFr() {
  return (
    <>
      <p className="legal-doc__note">
        Portfolium est open-source et auto-hébergé : vos données sont stockées dans la base de
        données de l’instance spécifique que vous utilisez, exploitée par la personne ou
        l’organisation qui l’a déployée, appelée l’<strong>opérateur</strong> — et non par une
        société Portfolium centrale. Cette politique décrit ce que le logiciel Portfolium collecte
        et fait des données par défaut. L’opérateur de votre instance est responsable des
        coordonnées de contact ci-dessous et de tout traitement supplémentaire qu’il configure.
      </p>

      <h2>1. Données collectées par Portfolium</h2>

      <h3>Données de compte</h3>
      <p>
        Lors de votre inscription, Portfolium stocke votre adresse e-mail, votre nom d’utilisateur,
        un mot de passe haché de manière sécurisée et, en option, un nom complet. Si vous activez
        l’authentification à deux facteurs, le secret 2FA associé est également stocké.
      </p>

      <h3>Données de portefeuille et de transactions</h3>
      <p>
        Portfolium stocke les portefeuilles, positions, watchlists, boards, mises en page
        sauvegardées et transactions que vous créez, ainsi que les analyses dérivées, telles que la
        performance, la répartition, les insights et les graphiques calculés à partir de ces
        données.
      </p>

      <h3>Données de notification et de calendrier</h3>
      <p>
        Si vous activez les notifications, rapports ou fonctionnalités liées au calendrier,
        Portfolium stocke vos préférences de notification et l’historique d’envoi.
      </p>

      <h3>Données techniques</h3>
      <p>
        Portfolium délivre un jeton de session, par exemple un JSON Web Token, lors de la
        connexion. Ce jeton est stocké dans le stockage local de votre navigateur et sert à
        authentifier les requêtes vers l’API de l’instance que vous utilisez. L’API et son
        infrastructure sous-jacente peuvent conserver des journaux serveur standards, tels que les
        horodatages de requêtes, adresses IP, informations de navigateur et journaux d’erreur, à des
        fins opérationnelles et de sécurité. La durée de conservation de ces journaux est déterminée
        par l’opérateur.
      </p>

      <h2>2. Ce que Portfolium ne fait pas</h2>
      <p>
        L’application Portfolium n’intègre par défaut aucun script tiers de publicité, d’analyse ou
        de suivi inter-sites. Elle ne vend ni ne partage vos données avec des annonceurs.
        Portfolium utilise le stockage local du navigateur uniquement pour les fonctionnalités
        strictement nécessaires d’authentification et de session, et non à des fins publicitaires ou
        de suivi inter-sites.
      </p>

      <h2>3. Sous-traitants tiers</h2>
      <p>
        Selon la configuration de l’instance par l’opérateur, les tiers suivants peuvent traiter
        certaines données pour le compte de l’instance :
      </p>

      <ul>
        <li>
          <strong>Fournisseurs de données de marché</strong>, par exemple Yahoo Finance ou des
          fournisseurs similaires, peuvent fournir les cours, données fondamentales, logos, données
          de référence et informations de marché utilisées par l’application. Les requêtes vers ces
          fournisseurs sont généralement effectuées par le serveur et n’incluent pas votre mot de
          passe ni vos notes privées de portefeuille.
        </li>
        <li>
          <strong>Fournisseurs d’e-mails sortants</strong>, si configurés par l’opérateur, peuvent
          être utilisés pour envoyer les e-mails de vérification de compte, de réinitialisation de
          mot de passe et de notification. Cela nécessite de transmettre votre adresse e-mail et le
          contenu du message concerné à ce fournisseur.
        </li>
        <li>
          <strong>Fournisseurs d’infrastructure</strong>, tels que les hébergeurs, bases de
          données, systèmes de stockage, de supervision ou de sauvegarde, peuvent traiter des
          données dans la mesure nécessaire à l’exploitation de l’instance.
        </li>
      </ul>

      <h2>4. Transferts internationaux</h2>
      <p>
        Selon le déploiement de l’opérateur et les prestataires configurés, certains traitements
        peuvent impliquer des fournisseurs situés hors de votre pays ou hors de l’Espace économique
        européen. L’opérateur est responsable de mettre en place les garanties appropriées lorsque
        cela est requis par la loi applicable.
      </p>

      <h2>5. Partage public de portefeuille</h2>
      <p>
        Si vous activez le partage public d’un portefeuille, Portfolium génère un lien permettant à
        toute personne disposant du lien de consulter la répartition en pourcentages par secteur et
        zone géographique de ce portefeuille, ainsi que son tableau des principales positions,
        incluant le symbole, le nom, le pays, le secteur, l’industrie et le poids. Les montants
        absolus, quantités et prix de revient ne sont pas exposés via un lien public par défaut.
        Aucune donnée n’est partagée publiquement pour un portefeuille tant que vous n’avez pas
        explicitement activé le partage pour celui-ci. La désactivation du partage invalide le lien
        précédent.
      </p>

      <h2>6. Utilisation de vos données</h2>
      <p>Les données que vous fournissez sont utilisées pour :</p>

      <ul>
        <li>Gérer votre compte et vous authentifier.</li>
        <li>Calculer et afficher vos analyses de portefeuille, graphiques, boards et insights.</li>
        <li>Stocker vos watchlists, votre historique de recherche, vos mises en page sauvegardées et vos préférences.</li>
        <li>Envoyer les e-mails liés au compte et, lorsque cela est activé, les notifications.</li>
        <li>Maintenir la sécurité, la fiabilité et l’intégrité de l’instance.</li>
      </ul>

      <p>
        Portfolium n’utilise pas vos données pour entraîner des modèles d’apprentissage automatique
        par défaut et n’utilise pas vos données à des fins publicitaires.
      </p>

      <h2>7. Base légale du traitement</h2>
      <p>
        Selon la fonctionnalité concernée et la configuration de l’opérateur, les données
        personnelles peuvent être traitées parce que cela est nécessaire à la fourniture du service,
        à la sécurisation de l’instance, au respect d’obligations légales, ou sur la base de
        l’intérêt légitime de l’opérateur à maintenir et améliorer l’application. Lorsqu’une
        fonctionnalité nécessite un consentement au regard de la loi applicable, l’opérateur est
        responsable de recueillir et gérer ce consentement.
      </p>

      <h2>8. Conservation et suppression des données</h2>
      <p>
        Vos données sont conservées tant que votre compte existe sur l’instance, sauf si
        l’opérateur définit une durée de conservation différente. Vous pouvez demander la
        suppression de votre compte et de vos données à l’opérateur à tout moment. Portfolium étant
        un logiciel auto-hébergé, l’opérateur est responsable de procéder à la suppression et de
        déterminer la durée de conservation des sauvegardes de son déploiement.
      </p>

      <h2>9. Sécurité des données</h2>
      <p>
        Les mots de passe sont stockés au moyen d’un hachage cryptographique salé, jamais en texte
        clair. Une authentification à deux facteurs optionnelle est disponible pour renforcer la
        sécurité de votre compte. La sécurité globale d’une instance, incluant le chiffrement du
        transport, le durcissement de l’infrastructure, les contrôles d’accès et les sauvegardes,
        dépend de la manière dont l’opérateur l’a déployée et maintenue.
      </p>

      <h2>10. Vos droits</h2>
      <p>
        Selon votre juridiction, vous pouvez disposer de droits d’accès, de rectification,
        d’exportation ou de suppression de vos données personnelles, ainsi que du droit de vous
        opposer à certains traitements ou d’en demander la limitation. Vous pouvez également
        disposer du droit de retirer votre consentement lorsque le traitement repose sur celui-ci.
        Pour exercer ces droits, contactez l’opérateur de votre instance aux coordonnées ci-dessous.
      </p>

      <p>
        Vous pouvez également introduire une réclamation auprès de l’autorité de protection des
        données compétente, notamment la CNIL si l’instance est exploitée en France.
      </p>

      <h2>11. Confidentialité des mineurs</h2>
      <p>
        Portfolium ne s’adresse pas aux enfants, et l’inscription d’un compte n’est pas destinée
        aux personnes n’ayant pas atteint la majorité légale dans leur juridiction.
      </p>

      <h2>12. Modifications de cette politique</h2>
      <p>
        L’opérateur peut mettre à jour cette politique de temps à autre. Les modifications
        importantes seront reflétées par la mise à jour de la date de « dernière mise à jour »
        ci-dessus.
      </p>

      <h2>13. Contact</h2>
      <ContactCard
        contactLabel="Questions de confidentialité & demandes de données"
        sourceLabel="Code source & traitement des données"
      />
    </>
  )
}