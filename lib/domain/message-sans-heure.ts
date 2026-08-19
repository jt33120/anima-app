/**
 * message-sans-heure.ts — CE QU'ANAM DIT QUAND L'HEURE DE NAISSANCE MANQUE (FR-050).
 *
 * Posée INERTE en Story 2.7 (la formulation existait, personne ne la lisait), RÉVEILLÉE et
 * RÉÉCRITE en Story 5.3 — c'est la story qui met enfin ces phrases sous les yeux de quelqu'un.
 *
 * ── CE QUE FR-050 EXIGE, MOT POUR MOT ──────────────────────────────────────────────────────────
 *
 *   « Anam annonce ce qui manque ET POURQUOI — “je préfère ne pas te l'inventer” — ET INDIQUE OÙ
 *     TROUVER L'HEURE. »
 *
 * La version de la 2.7 en tenait la première moitié et renvoyait « dans ton profil » — un écran qui
 * n'existe pas. La seconde moitié (l'acte de naissance, la mairie) manquait entièrement : c'est
 * pourtant la seule partie qui AIDE. Dire « il me manque ton heure » sans dire où la chercher, c'est
 * désigner un manque et laisser quelqu'un devant.
 *
 * ── CE N'EST PAS DU CORPUS D'ANIMA (et donc pas bloqué par la porte pré-lancement) ─────────────
 *
 * FR-054 couvre les INTERPRÉTATIONS — le sens d'un nombre, d'un signe, d'une carte. Ces phrases-ci
 * n'interprètent rien : elles disent ce que le produit ne sait pas et comment y remédier. Même
 * catégorie que `PHRASE_INVITATION` (4.10) ou `VIDE_OU_NAISSENT_LES_BRANCHES` (3.3).
 *
 * En revanche c'est bien la VOIX D'ANAM — FR-050 cite une première personne — donc :
 *   • le contrôle de voix de la 2.8 s'applique de plein droit (`tests/lexique-voix.test.ts`) ;
 *   • ET le détecteur de prédiction de la 5.2 est appliqué ici aussi (`tests/socle-incomplet.test.ts`).
 *     C'est ce qui impose « tu PEUX l'ajouter » plutôt que « tu POURRAS » : un futur adressé, même
 *     anodin, reste un futur adressé, et la meilleure phrase est de toute façon la première.
 */

/**
 * L'aveu. Ce qui manque, pourquoi, et ce qui reste — dans cet ordre : on ne laisse pas quelqu'un
 * sur un manque avant de lui avoir dit que le reste est là.
 *
 * « certains jours » n'est pas une précaution de style : sans heure, un corps dont le signe change
 * dans la journée est réellement indéterminable (Story 5.3, D1), et la Lune est dans ce cas près
 * de deux fois sur cinq. La phrase dit donc exactement ce que le calcul fait.
 */
export const MESSAGE_SANS_HEURE =
  "Il me manque ton heure de naissance. Sans elle, l’ascendant et les maisons ne se calculent " +
  "pas, et certains jours la Lune change de signe sans qu’on puisse savoir de quel côté tu es " +
  "née : je préfère ne pas te l’inventer. Tout le reste est là — ton soleil, tes planètes, ta " +
  "numérologie. Tu peux ajouter ton heure quand tu veux ; rien ne se bloque sans elle.";

/**
 * Où la trouver. Deux phrases, deux faits — et rien de plus.
 *
 * L'heure de naissance ne figure PAS sur l'extrait d'acte de naissance ordinaire ni sur le livret
 * de famille : seule la COPIE INTÉGRALE la porte. C'est le détail qui fait la différence entre une
 * démarche qui aboutit et un aller-retour à la mairie pour rien — et c'est précisément pour ça que
 * FR-050 demande d'indiquer où chercher plutôt que de dire « demande-la ».
 */
export const OU_TROUVER_SON_HEURE =
  "Ton heure de naissance est écrite sur la copie intégrale de ton acte de naissance — pas sur " +
  "l’extrait simple, ni sur le livret de famille. La mairie de ta commune de naissance la délivre " +
  "gratuitement, sur place ou par internet.";
