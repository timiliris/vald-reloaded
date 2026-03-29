# Politique de confidentialite — Vald Reloaded

*Derniere mise a jour : 29 mars 2026*

## Editeur

Cette extension est developpee par **Timiliris_420** et distribuee gratuitement via le Chrome Web Store.

Contact : [github.com/timiliris](https://github.com/timiliris)

## Donnees collectees

**Cette extension ne collecte aucune donnee personnelle.**

- Aucun compte utilisateur n'est requis
- Aucune donnee de navigation n'est collectee
- Aucun cookie ou traceur n'est utilise
- Aucune donnee n'est partagee avec des tiers
- Aucune analyse comportementale n'est effectuee

## Stockage local

L'extension utilise `chrome.storage.local` pour enregistrer uniquement :

- Tes preferences de notification (son, persistance)
- Le dernier statut connu du stream (live/offline)
- L'horodatage de la derniere verification

Ces donnees restent **exclusivement sur ton appareil** et ne sont jamais transmises a un serveur.

## Communications reseau

L'extension effectue des requetes vers l'API `valdapi.3de-scs.tech` pour recuperer :

- Le statut du stream Twitch de Vald (live/offline)
- L'historique des streams passes
- Les clips Twitch recents

Ces requetes ne contiennent **aucune information personnelle**. Seule l'adresse IP est transmise de maniere technique lors de la connexion au serveur (comme pour toute requete HTTP). Cette adresse IP n'est pas collectee ni stockee a des fins d'identification.

## Permissions de l'extension

| Permission | Justification |
|---|---|
| `alarms` | Verifier periodiquement le statut du stream |
| `notifications` | Afficher les alertes de stream |
| `storage` | Sauvegarder les preferences localement |
| `host_permissions` | Communiquer avec l'API valdapi.3de-scs.tech |

## Tes droits (RGPD)

Conformement au Reglement General sur la Protection des Donnees (RGPD) :

- **Droit d'acces** — L'extension ne stockant aucune donnee personnelle sur nos serveurs, il n'y a aucune donnee a consulter
- **Droit de suppression** — Desinstaller l'extension supprime automatiquement toutes les donnees locales
- **Droit d'opposition** — Tu peux desactiver les notifications dans les parametres a tout moment

Pour toute question, contacte-nous via [GitHub](https://github.com/timiliris).

## Modifications

Cette politique peut etre mise a jour. Les modifications seront indiquees par la date de derniere mise a jour en haut de ce document.

## Licence

Cette extension est publiee sous [licence MIT](LICENSE).
