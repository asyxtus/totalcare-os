// lib/docs/content.ts
//
// The actual documentation. Structured as articles grouped into sections,
// each article scoped to the roles that need it. Content is workflow-first
// ("when X happens, do this") not feature-first ("this button does Y").
//
// Adding a new article: add an entry here with the right roles array.
// The docs page automatically includes it in those roles' view.

import type { StaffRole } from '@/lib/types'

export interface DocArticle {
  id: string
  section: string
  sectionEn: string
  title: string
  titleEn: string
  roles: StaffRole[]
  content: string      // Markdown-style, rendered as structured HTML
  contentEn: string
  tags: string[]       // searchable
}

export const DOC_ARTICLES: DocArticle[] = [

  // ─── GETTING STARTED ──────────────────────────────────────────────────────

  {
    id: 'first-login',
    section: 'Premiers pas', sectionEn: 'Getting started',
    title: 'Première connexion et configuration du profil',
    titleEn: 'First login and profile setup',
    roles: ['admin', 'doctor', 'nurse', 'pharmacist', 'lab_technician', 'receptionist', 'billing_clerk', 'auditor'],
    tags: ['connexion', 'login', 'mot de passe', 'password', 'profil', 'profile', 'langue', 'language', 'thème', 'theme'],
    content: `
Vous recevrez un email d'invitation avec un lien pour définir votre mot de passe. Ce lien expire après 24 heures — demandez un nouvel envoi à votre administrateur si nécessaire.

**Changer la langue et le thème**
En bas du menu latéral gauche, deux commandes permettent de basculer entre Français et English, et entre les thèmes Clair, Sombre ou Système (suit votre appareil). Ce réglage est personnel et s'applique immédiatement à tout l'écran.

**Naviguer dans l'application**
Le menu latéral gauche affiche uniquement les modules auxquels votre rôle a accès — les autres ne sont pas masqués par erreur, vous n'avez simplement pas les droits pour y accéder. Sur mobile, le même menu est accessible en faisant glisser horizontalement la barre du bas.
    `,
    contentEn: `
You will receive an invitation email with a link to set your password. This link expires after 24 hours — ask your administrator to resend it if needed.

**Changing language and theme**
At the bottom of the left sidebar, two controls let you switch between French and English, and between Light, Dark, or System theme (follows your device). This setting is personal and applies immediately across the whole screen.

**Navigating the app**
The left sidebar only shows modules your role can access — others aren't hidden by mistake, you simply don't have permission to access them. On mobile, the same navigation is accessible by scrolling the bottom bar horizontally.
    `,
  },

  // ─── RECEPTION ────────────────────────────────────────────────────────────

  {
    id: 'reception-walkin',
    section: 'Réception', sectionEn: 'Reception',
    title: 'Accueillir un patient qui se présente à la réception',
    titleEn: 'Checking in a walk-in patient',
    roles: ['receptionist', 'admin', 'nurse', 'doctor'],
    tags: ['checkin', 'check-in', 'visite', 'visit', 'enregistrer', 'register', 'comptant', 'cash', 'paiement', 'payment'],
    content: `
**Flux complet pour un patient en comptant**

1. Ouvrez **Patients** dans le menu et recherchez le patient par nom, code ou téléphone.
2. Si le patient est nouveau, cliquez **Nouveau patient** et remplissez la fiche (nom, sexe, âge, CNI si disponible).
3. Sur la fiche du patient, choisissez le **type de consultation** et le médecin dans le panneau en haut à droite, puis cliquez **Démarrer la visite**.
4. La visite passe immédiatement en statut **En attente de paiement**. Le formulaire de paiement apparaît : sélectionnez le mode (Comptant / MTN MoMo / Orange Money), entrez la référence de transaction si besoin, puis cliquez **Encaisser**.
5. Une fois encaissé, le patient apparaît dans la **file d'attente médecin** et reçoit un numéro de file.

**Urgence sans paiement préalable**
Si le patient est en état d'urgence, cliquez **Signaler comme urgence** dans le formulaire de paiement. Entrez le motif d'urgence (obligatoire pour la traçabilité). Le patient est envoyé directement en consultation sans paiement — la régularisation se fait après.

**Que faire si l'encaissement échoue mais que le patient a déjà payé ?**
Il peut arriver que le paiement soit enregistré côté serveur mais que l'écran ne se soit pas mis à jour. Si le statut reste bloqué sur "En attente de paiement" alors que le patient a payé, un bouton **Continuer** apparaît automatiquement. Cliquez-le sans re-payer.
    `,
    contentEn: `
**Full flow for a cash patient**

1. Open **Patients** from the menu and search for the patient by name, code, or phone.
2. If the patient is new, click **New patient** and fill in their record (name, sex, age, national ID if available).
3. On the patient's record, choose the **consultation type** and doctor in the top-right panel, then click **Start visit**.
4. The visit immediately enters **Awaiting payment** status. The payment form appears: select the method (Cash / MTN MoMo / Orange Money), enter the transaction reference if needed, then click **Collect**.
5. Once collected, the patient appears in the **doctor queue** and receives a queue number.

**Emergency without upfront payment**
If the patient is in an emergency state, click **Flag as emergency** in the payment form. Enter the emergency reason (required for traceability). The patient is sent directly to consultation without payment — regularisation happens afterward.

**What if payment collection fails but the patient already paid?**
It can happen that payment registers server-side but the screen doesn't update. If the status stays stuck on "Awaiting payment" when the patient has already paid, a **Continue** button appears automatically. Click it without paying again.
    `,
  },

  {
    id: 'reception-appointments',
    section: 'Réception', sectionEn: 'Reception',
    title: 'Gérer les rendez-vous',
    titleEn: 'Managing appointments',
    roles: ['receptionist', 'admin', 'doctor', 'nurse'],
    tags: ['rendez-vous', 'appointment', 'agenda', 'calendrier', 'calendar', 'annuler', 'cancel', 'absent', 'no-show'],
    content: `
Les rendez-vous et la file d'attente se trouvent dans le même écran **Réception**, dans deux onglets séparés.

**Créer un rendez-vous**
Dans l'onglet Rendez-vous, cliquez **+ Nouveau rendez-vous**. Commencez à taper le nom du patient — la liste filtre en temps réel. Si le patient n'existe pas encore, créez-le d'abord dans **Patients**. Renseignez date, heure, durée, médecin (optionnel) et type de consultation (optionnel). Le type de consultation préselectionné sera automatiquement reporté lors du check-in.

**Quand le patient arrive**
Cliquez **Enregistrer l'arrivée** sur le rendez-vous concerné. Vous serez redirigé vers la fiche du patient avec le type de consultation et le médecin déjà pré-remplis — vérifiez et confirmez simplement.

**Marquer un patient absent**
Si le patient ne se présente pas, cliquez **Absent** sur le rendez-vous. Cela archive le rendez-vous sans le supprimer, pour garder une trace des taux de présence.

**Naviguer entre les jours**
Utilisez les boutons ← Précédent / Suivant → pour changer de jour. L'application mémorise la date consultée dans l'URL — vous pouvez donc créer des marque-pages ou partager des liens vers un jour précis.
    `,
    contentEn: `
Appointments and the walk-in queue live on the same **Reception** screen, in two separate tabs.

**Creating an appointment**
In the Appointments tab, click **+ New appointment**. Start typing the patient's name — the list filters in real time. If the patient doesn't exist yet, create them first in **Patients**. Fill in date, time, duration, doctor (optional), and consultation type (optional). The preselected consultation type will carry over automatically at check-in.

**When the patient arrives**
Click **Check in arrival** on the relevant appointment. You'll be redirected to the patient's record with the consultation type and doctor already pre-filled — just verify and confirm.

**Marking a no-show**
If the patient doesn't show up, click **No-show** on the appointment. This archives the appointment without deleting it, to keep a record of attendance rates.

**Navigating between days**
Use the ← Previous / Next → buttons to change days. The app stores the date in the URL — you can bookmark or share links to a specific day.
    `,
  },

  // ─── PATIENTS ─────────────────────────────────────────────────────────────

  {
    id: 'patients-new',
    section: 'Patients', sectionEn: 'Patients',
    title: 'Créer et gérer les dossiers patients',
    titleEn: 'Creating and managing patient records',
    roles: ['receptionist', 'admin', 'doctor', 'nurse'],
    tags: ['nouveau patient', 'new patient', 'fiche', 'record', 'CNI', 'assurance', 'insurance', 'doublons', 'duplicates'],
    content: `
**Créer un nouveau patient**
Cliquez **Nouveau patient** en haut de la liste Patients. Les champs obligatoires sont : nom complet, et au moins un indicateur d'âge (date de naissance ou âge estimé). Le numéro CNI est fortement recommandé quand disponible — il permet la détection de doublons.

**Détection de doublons**
Si un patient avec le même numéro CNI existe déjà dans la clinique, l'enregistrement s'arrête et affiche le nom et le code du patient existant. Vous avez trois options :
- **Ouvrir le dossier existant** — si c'est bien le même patient
- **Créer quand même** — pour les cas légitimes (même CNI partagé dans une famille, carte refaite)
- **Annuler** — pour corriger le numéro

**Patients couverts par une assurance**
Lors de la création, changez la **Catégorie de paiement** en "Régime employeur" ou "Assurance privée". Un formulaire de couverture apparaît. Sélectionnez l'assureur (doit être configuré dans Facturation → Assurance), entrez le numéro de police et le titulaire si différent du patient.

**Rechercher un patient**
La barre de recherche filtre par nom, code patient (ex. PAT-0042) ou numéro de téléphone. La recherche est instantanée dès 2 caractères.
    `,
    contentEn: `
**Creating a new patient**
Click **New patient** at the top of the Patients list. Required fields are: full name, and at least one age indicator (date of birth or estimated age). The national ID number is strongly recommended when available — it enables duplicate detection.

**Duplicate detection**
If a patient with the same national ID already exists in the clinic, registration stops and shows the existing patient's name and code. You have three options:
- **Open existing record** — if it's the same patient
- **Create anyway** — for legitimate cases (shared ID within a family, replacement card)
- **Cancel** — to correct the number

**Insurance-covered patients**
When creating a patient, change the **Payment category** to "Employer scheme" or "Private insurance". A coverage form appears. Select the insurer (must be configured in Billing → Insurance), enter the policy number and policyholder name if different from the patient.

**Searching for a patient**
The search bar filters by name, patient code (e.g. PAT-0042), or phone number. Search is instant from 2 characters.
    `,
  },

  // ─── CLINICAL ─────────────────────────────────────────────────────────────

  {
    id: 'triage-workflow',
    section: 'Clinique', sectionEn: 'Clinical',
    title: 'Effectuer un triage',
    titleEn: 'Performing triage',
    roles: ['nurse', 'admin', 'doctor'],
    tags: ['triage', 'constantes', 'vitals', 'tension', 'bp', 'température', 'temperature', 'SpO2', 'poids', 'weight'],
    content: `
Le triage est accessible depuis la file d'attente infirmière. Cliquez **Triage** sur le patient concerné.

**Saisir les constantes**
Tension systolique et diastolique, pouls, température, SpO2, fréquence respiratoire, poids et taille. Aucun champ n'est obligatoire — renseignez ce qui est disponible et pertinent pour la consultation.

**Valeurs critiques**
Si une valeur dépasse les seuils critiques configurés (ex. SpO2 < 85%, tension > 180/120), l'application affiche une alerte avant de continuer. Vous devez explicitement confirmer avoir pris connaissance des valeurs critiques — cette confirmation est enregistrée dans le journal d'audit pour la traçabilité.

**Évaluation infirmière**
Après les constantes, renseignez le motif de consultation, les antécédents médicaux pertinents et le contexte social. Ces informations seront visibles par le médecin lors de la consultation.

**Finaliser le triage**
Cliquez **Terminer le triage**. Le patient passe automatiquement dans la file d'attente médecin.
    `,
    contentEn: `
Triage is accessible from the nursing queue. Click **Triage** on the relevant patient.

**Recording vital signs**
Systolic and diastolic BP, pulse, temperature, SpO2, respiratory rate, weight and height. No field is mandatory — record what is available and relevant for the consultation.

**Critical values**
If a value exceeds the configured critical thresholds (e.g. SpO2 < 85%, BP > 180/120), the app displays an alert before continuing. You must explicitly confirm you have reviewed the critical values — this confirmation is recorded in the audit log for traceability.

**Nursing assessment**
After vitals, fill in the chief complaint, relevant medical history, and social context. This information will be visible to the doctor during consultation.

**Completing triage**
Click **Complete triage**. The patient automatically moves to the doctor queue.
    `,
  },

  {
    id: 'consultation-workflow',
    section: 'Clinique', sectionEn: 'Clinical',
    title: 'Conduire une consultation (SOAP)',
    titleEn: 'Conducting a consultation (SOAP)',
    roles: ['doctor', 'admin'],
    tags: ['consultation', 'SOAP', 'diagnostic', 'diagnosis', 'ordonnance', 'prescription', 'ICD', 'CIM-10', 'laboratoire', 'lab', 'admission'],
    content: `
La consultation utilise le format SOAP : Subjectif, Objectif, Évaluation, Plan.

**Modèle de consultation**
Choisissez un modèle (Maladies courantes, Prénatal, Suivi de l'enfant, Examen annuel) pour pré-remplir les champs avec des guides de saisie adaptés. Vous pouvez toujours modifier le contenu librement.

**Ordonnance**
Ajoutez des médicaments depuis le stock de la pharmacie (recherche par nom) ou en texte libre pour les médicaments hors stock. Pour chaque médicament : dose, fréquence, durée, quantité. Le système vérifie les allergies connues du patient et affiche une alerte si un médicament correspond à une allergie déclarée.

**Examens de laboratoire**
Cochez les bilans ou tests à prescrire. Ils apparaîtront immédiatement dans la file du laboratoire. Vous pouvez aussi saisir des examens externes (IRM, biopsie) en texte libre — ceux-ci ne génèrent pas de frais dans le système.

**Code CIM-10**
Le champ de diagnostic accepte un code CIM-10 optionnel. Ce code s'imprime sur le compte-rendu et est transmis si une demande de prise en charge assurance est émise.

**Admettre le patient**
Cochez **Admettre le patient** pour déclencher le processus d'admission hospitalière. Renseignez le motif d'admission. Le service Admissions assignera le lit séparément — la consultation se termine normalement en parallèle.

**Finaliser**
Cliquez **Terminer la consultation**. L'ordonnance est transmise à la pharmacie, les examens au laboratoire. Le patient passe en statut suivant.
    `,
    contentEn: `
The consultation uses the SOAP format: Subjective, Objective, Assessment, Plan.

**Consultation template**
Choose a template (Common illnesses, Antenatal, Well-child, Annual physical) to pre-fill fields with appropriate prompts. You can always modify the content freely.

**Prescription**
Add medications from pharmacy stock (search by name) or as free text for off-stock medications. For each medication: dose, frequency, duration, quantity. The system checks the patient's known allergies and displays an alert if a medication matches a declared allergy.

**Laboratory tests**
Check the panels or tests to order. They will immediately appear in the laboratory queue. You can also enter external tests (MRI, biopsy) as free text — these do not generate charges in the system.

**ICD-10 code**
The diagnosis field accepts an optional ICD-10 code. This code prints on the consultation report and is passed along if an insurance pre-authorisation is requested.

**Admitting the patient**
Check **Admit patient** to trigger the hospital admission process. Fill in the reason for admission. The Admissions department will assign the bed separately — the consultation finishes normally in parallel.

**Completing the consultation**
Click **Complete consultation**. The prescription goes to pharmacy, the tests go to the laboratory. The patient moves to the next status.
    `,
  },

  // ─── PHARMACY ─────────────────────────────────────────────────────────────

  {
    id: 'pharmacy-dispensing',
    section: 'Pharmacie', sectionEn: 'Pharmacy',
    title: 'Dispenser une ordonnance',
    titleEn: 'Dispensing a prescription',
    roles: ['pharmacist', 'admin'],
    tags: ['dispenser', 'dispense', 'ordonnance', 'prescription', 'lot', 'batch', 'stock', 'FIFO', 'témoin', 'witness'],
    content: `
**Trouver l'ordonnance à dispenser**
Ouvrez **Pharmacie** → **Dispensation**. Les ordonnances en attente apparaissent à gauche. Cliquez sur l'une d'elles pour voir le détail à droite.

**Dispenser article par article**
Pour chaque médicament de l'ordonnance, cliquez **Délivrer**. Le système propose les lots disponibles en ordre FIFO (le plus proche de la péremption en premier). Entrez la quantité à délivrer et le prix unitaire (pré-rempli depuis le stock). Un **témoin** doit être sélectionné pour les substances contrôlées.

**Sécurité MAR**
Si un médicament est admis (patient hospitalisé), il ne peut pas être marqué "Administré" dans la feuille MAR tant que la pharmacie n'a pas dispensé au moins la quantité administrée. Ce contrôle est automatique.

**Stock insuffisant**
Si le stock est insuffisant pour une quantité demandée, dispensez ce qui est disponible. Le reliquat restera en attente. Pensez à créer une commande fournisseur pour réapprovisionner.

**Imprimer l'étiquette**
Après dispensation, un lien **Imprimer l'étiquette** apparaît sur chaque article. L'étiquette inclut le nom du patient, le médicament, la posologie et les instructions.
    `,
    contentEn: `
**Finding the prescription to dispense**
Open **Pharmacy** → **Dispensing**. Pending prescriptions appear on the left. Click one to see the detail on the right.

**Dispensing item by item**
For each medication in the prescription, click **Dispense**. The system proposes available batches in FIFO order (closest to expiry first). Enter the quantity to dispense and unit price (pre-filled from stock). A **witness** must be selected for controlled substances.

**MAR safety**
If a medication is for an admitted patient, it cannot be marked "Administered" in the MAR sheet until the pharmacy has dispensed at least the administered quantity. This check is automatic.

**Insufficient stock**
If stock is insufficient for a requested quantity, dispense what is available. The remainder will stay pending. Remember to create a supplier order to restock.

**Printing the label**
After dispensing, a **Print label** link appears on each item. The label includes the patient name, medication, dosage, and instructions.
    `,
  },

  {
    id: 'pharmacy-stock',
    section: 'Pharmacie', sectionEn: 'Pharmacy',
    title: 'Gérer le stock et les approvisionnements',
    titleEn: 'Managing stock and procurement',
    roles: ['pharmacist', 'admin'],
    tags: ['inventaire', 'inventory', 'stock', 'commande', 'order', 'fournisseur', 'supplier', 'réception', 'receiving', 'péremption', 'expiry', 'ajustement', 'adjustment'],
    content: `
**Inventaire et seuils**
L'écran **Inventaire** affiche tous les produits avec leur stock actuel, leur seuil de réapprovisionnement et leur statut. Les produits en stock faible (sous le seuil) ou épuisés sont filtrables via les boutons en haut.

**Créer une commande fournisseur**
Dans **Commandes**, cliquez **+ Nouvelle commande**. Sélectionnez le fournisseur, ajoutez les produits et quantités souhaitées. La commande est d'abord en brouillon — validez-la puis marquez-la **Envoyée** quand elle part chez le fournisseur.

**Réceptionner une livraison**
Dans **Réception**, créez une réception liée à la commande (ou en réception directe). Pour chaque article livré, renseignez le numéro de lot, la date de péremption et la quantité reçue. Le stock est mis à jour immédiatement à la validation.

**Ajuster le stock manuellement**
Allez dans **Ajustements**. Sélectionnez le lot à ajuster, entrez la quantité (positive pour ajouter, negative pour retirer) et un motif obligatoire. Tous les ajustements sont tracés dans le journal d'audit.

**Rappel de lot**
Si un lot est défectueux ou contaminé, allez dans **Rappels** et initiez un rappel. Le système identifie automatiquement les patients qui ont reçu ce lot et génère la liste de contact. Les ventes au comptoir anonymes (sans patient lié) sont signalées séparément.
    `,
    contentEn: `
**Inventory and thresholds**
The **Inventory** screen shows all products with their current stock, reorder threshold, and status. Products with low stock (below threshold) or out of stock are filterable via the buttons at the top.

**Creating a supplier order**
In **Orders**, click **+ New order**. Select the supplier, add the desired products and quantities. The order starts as a draft — validate it then mark it **Sent** when it leaves for the supplier.

**Receiving a delivery**
In **Receiving**, create a receipt linked to the order (or as a direct receipt). For each delivered item, enter the batch number, expiry date, and received quantity. Stock is updated immediately on validation.

**Manual stock adjustment**
Go to **Adjustments**. Select the batch to adjust, enter the quantity (positive to add, negative to remove) and a mandatory reason. All adjustments are traced in the audit log.

**Batch recall**
If a batch is defective or contaminated, go to **Recalls** and initiate a recall. The system automatically identifies patients who received this batch and generates the contact list. Anonymous counter sales (without a linked patient) are flagged separately.
    `,
  },

  // ─── LABORATORY ───────────────────────────────────────────────────────────

  {
    id: 'lab-workflow',
    section: 'Laboratoire', sectionEn: 'Laboratory',
    title: 'Traiter les examens de laboratoire',
    titleEn: 'Processing laboratory tests',
    roles: ['lab_technician', 'admin', 'doctor'],
    tags: ['labo', 'lab', 'résultats', 'results', 'valider', 'verify', 'anormal', 'abnormal', 'critique', 'critical', 'bilan', 'panel'],
    content: `
**File d'attente laboratoire**
L'écran **Laboratoire** affiche les demandes en attente, triées par ordre d'arrivée. Chaque demande montre le patient, le type d'examen et le prescripteur.

**Marquer comme prélevé**
Cliquez **Marquer comme prélevé** dès que l'échantillon est collecté. Cela indique au médecin que l'examen est en cours.

**Saisir les résultats**
Cliquez sur la demande pour ouvrir le formulaire de résultats. Pour les tests quantitatifs, entrez la valeur numérique — le système compare automatiquement aux plages de référence et signale les valeurs anormales ou critiques. Pour les tests qualitatifs, sélectionnez le résultat dans la liste.

**Valeurs critiques**
Une valeur critique (hors des limites de sécurité configurées) est mise en évidence en rouge. Elle doit être communiquée immédiatement au médecin prescripteur — le système vous y invite mais ne peut pas remplacer l'appel téléphonique.

**Valider les résultats**
Après vérification, cliquez **Valider**. Les résultats validés deviennent visibles dans la fiche du patient et dans la consultation du médecin. Les résultats non validés restent marqués "(non validé)" sur les impressions.

**Tests externes**
Les examens prescrits comme "externes" (IRM, biopsie, etc.) n'apparaissent pas dans votre file — ils ont été envoyés à un laboratoire externe. Leurs résultats peuvent être attachés à la fiche du patient sous forme de document.
    `,
    contentEn: `
**Laboratory queue**
The **Laboratory** screen shows pending requests, sorted by arrival order. Each request shows the patient, test type, and requesting doctor.

**Marking as collected**
Click **Mark as collected** as soon as the sample is taken. This tells the doctor the test is underway.

**Entering results**
Click on the request to open the results form. For quantitative tests, enter the numeric value — the system automatically compares against reference ranges and flags abnormal or critical values. For qualitative tests, select the result from the list.

**Critical values**
A critical value (outside the configured safety limits) is highlighted in red. It must be communicated immediately to the requesting doctor — the system prompts you to do so but cannot replace the phone call.

**Verifying results**
After checking, click **Verify**. Verified results become visible in the patient's record and in the doctor's consultation. Unverified results remain marked "(not verified)" on printouts.

**External tests**
Tests ordered as "external" (MRI, biopsy, etc.) do not appear in your queue — they were sent to an external laboratory. Their results can be attached to the patient's record as a document.
    `,
  },

  // ─── INPATIENT ────────────────────────────────────────────────────────────

  {
    id: 'admissions-workflow',
    section: 'Hospitalisations', sectionEn: 'Inpatient',
    title: "Gérer les admissions et les sorties",
    titleEn: 'Managing admissions and discharges',
    roles: ['nurse', 'doctor', 'admin'],
    tags: ['admission', 'hospitalisation', 'inpatient', 'lit', 'bed', 'sortie', 'discharge', 'service', 'ward', 'transfert', 'transfer'],
    content: `
**Admettre un patient**
Quand un médecin recommande une admission lors d'une consultation, une demande apparaît dans **Admissions**. Ouvrez-la, sélectionnez le service et le lit disponible, puis confirmez l'admission. Le patient est désormais "hospitalisé" et son profil est accessible depuis la liste des admissions actives.

**Soins quotidiens (onglets du dossier d'hospitalisation)**
Chaque patient admis a un dossier avec cinq onglets :
- **MAR** (Feuille d'administration des médicaments) — consigner chaque prise de médicament
- **Signes vitaux** — enregistrer les constantes à chaque passage
- **Notes de visite** — saisir les observations de ronde (médecin, infirmier, spécialiste)
- **Laboratoire** — prescrire et consulter les résultats d'examens
- **Soins** — prescrire des médicaments supplémentaires et consigner les tâches de soins

**Facturation journalière automatique**
Les frais d'hébergement (tarif du service + soins infirmiers) sont calculés automatiquement chaque nuit à 1h00. Vous n'avez rien à saisir — le total apparaît dans la facture du patient.

**Transférer un patient entre services**
Dans le dossier du patient, un bouton **Transférer** permet de changer de service et de lit. Renseignez le motif du transfert.

**Sortie du patient**
Cliquez **Sortie** dans le dossier d'hospitalisation. Sélectionnez le type de sortie (Routine, Transfert vers un autre établissement, Contre avis médical, Décès). Le résumé de sortie et les notes de suivi sont imprimables pour le patient.
    `,
    contentEn: `
**Admitting a patient**
When a doctor recommends admission during a consultation, a request appears in **Admissions**. Open it, select the available ward and bed, then confirm the admission. The patient is now "admitted" and their record is accessible from the active admissions list.

**Daily care (inpatient record tabs)**
Each admitted patient has a record with five tabs:
- **MAR** (Medication Administration Record) — log each medication administration
- **Vital signs** — record vitals at each pass
- **Round notes** — enter observations from rounds (doctor, nurse, specialist)
- **Laboratory** — order and view test results
- **Care** — prescribe additional medications and log care tasks

**Automatic daily billing**
Accommodation charges (ward rate + nursing care) are calculated automatically every night at 1:00 AM. You don't need to enter anything — the total appears in the patient's invoice.

**Transferring a patient between wards**
In the patient's record, a **Transfer** button allows you to change wards and beds. Fill in the reason for transfer.

**Patient discharge**
Click **Discharge** in the inpatient record. Select the discharge type (Routine, Transfer to another facility, Against medical advice, Deceased). The discharge summary and follow-up notes are printable for the patient.
    `,
  },

  // ─── BILLING ──────────────────────────────────────────────────────────────

  {
    id: 'billing-workflow',
    section: 'Facturation', sectionEn: 'Billing',
    title: 'Gérer les paiements et la caisse',
    titleEn: 'Managing payments and the cashier',
    roles: ['billing_clerk', 'receptionist', 'admin'],
    tags: ['facturation', 'billing', 'paiement', 'payment', 'acompte', 'deposit', 'caisse', 'cashier', 'shift', 'service', 'assurance', 'insurance', 'remise', 'discount'],
    content: `
**File d'attente caisse**
L'onglet **File d'attente caisse** affiche les patients dont la facture est en attente de paiement. Cliquez sur un patient pour encaisser.

**Acomptes**
Un patient peut payer un acompte en avance (par exemple pour un forfait hospitalisation). Dans l'onglet **Compte patient**, recherchez le patient et utilisez le formulaire d'acompte. L'acompte est déduit automatiquement lors de la clôture de la facture.

**Remises**
Les remises supérieures au seuil configuré (par défaut 5 000 FCFA) nécessitent une approbation administrative. Elles apparaissent dans l'onglet **Approbations** pour validation par un administrateur.

**Assurance / prise en charge**
Pour les patients couverts, le système calcule automatiquement la part assurance et la part patient selon le pourcentage de couverture configuré. La part assurance génère une réclamation dans le module Assurance — à transmettre à l'assureur séparément.

**Clôturer le service de caisse**
En fin de poste, ouvrez **Réconciliation** et créez un service de caisse si ce n'est pas déjà fait. Entrez le montant compté en caisse. Le système calcule l'écart avec le montant attendu. Un écart significatif doit être noté et soumis à revue.

**Imprimer un reçu**
Depuis n'importe quel paiement finalisé, un lien **Imprimer le reçu** est disponible. Le reçu est bilingue (Français / English).
    `,
    contentEn: `
**Cashier queue**
The **Cashier queue** tab shows patients whose invoice is awaiting payment. Click a patient to collect.

**Deposits**
A patient can pay a deposit in advance (e.g. for an inpatient package). In the **Patient account** tab, search for the patient and use the deposit form. The deposit is automatically deducted when the invoice is closed.

**Discounts**
Discounts above the configured threshold (default 5,000 FCFA) require administrative approval. They appear in the **Approvals** tab for validation by an administrator.

**Insurance / coverage**
For covered patients, the system automatically calculates the insurance share and the patient share based on the configured coverage percentage. The insurance share generates a claim in the Insurance module — to be transmitted to the insurer separately.

**Closing a cashier shift**
At the end of a shift, open **Reconciliation** and create a cashier shift if not already done. Enter the counted cash amount. The system calculates the variance against the expected amount. A significant variance must be noted and submitted for review.

**Printing a receipt**
From any finalised payment, a **Print receipt** link is available. The receipt is bilingual (French / English).
    `,
  },

  // ─── ADMINISTRATION ───────────────────────────────────────────────────────

  {
    id: 'admin-setup',
    section: 'Administration', sectionEn: 'Administration',
    title: 'Configurer la clinique (tarifs, services, personnel)',
    titleEn: 'Configuring the clinic (pricing, services, staff)',
    roles: ['admin'],
    tags: ['tarif', 'pricing', 'service', 'personnel', 'staff', 'inviter', 'invite', 'rôle', 'role', 'laboratoire', 'lab', 'hospitalisation', 'ward', 'désactiver', 'deactivate'],
    content: `
**Tarifs des services**
Dans **Administration** → onglet **Services**, configurez les types de consultation et leurs tarifs. Chaque service a un code unique (généré automatiquement depuis le nom, modifiable). Les services désactivés n'apparaissent plus dans les formulaires de check-in.

**Catalogue de laboratoire**
L'onglet **Laboratoire** permet de configurer les tests et bilans disponibles pour cette clinique, avec leurs tarifs, les plages de référence normales et les seuils critiques. Chaque clinique a son propre catalogue indépendant.

**Tarifs d'hospitalisation**
L'onglet **Hospitalisation** permet de configurer les tarifs journaliers par service, ainsi qu'un tarif de soins infirmiers commun à tous les services. Ces tarifs s'appliquent automatiquement via la facturation nocturne.

**Gérer le personnel**
L'onglet **Personnel** liste tous les membres actifs. Pour inviter un nouveau membre, cliquez **Inviter** — ils recevront un email avec un lien pour définir leur mot de passe. Vous pouvez changer le rôle d'un membre à tout moment. Désactiver un compte révoque immédiatement sa session active (le membre est déconnecté en quelques secondes).

**Rôles disponibles**
Chaque rôle donne accès à des modules spécifiques : Réceptionniste (réception, patients, rendez-vous), Médecin (consultation, admissions), Infirmier(ère) (triage, soins, admissions), Pharmacien (pharmacie), Technicien de labo (laboratoire), Agent de facturation (facturation), Auditeur (journal d'audit uniquement), Administrateur (tout).
    `,
    contentEn: `
**Service pricing**
In **Administration** → **Services** tab, configure consultation types and their prices. Each service has a unique code (auto-generated from the name, editable). Deactivated services no longer appear in check-in forms.

**Laboratory catalog**
The **Laboratory** tab lets you configure the tests and panels available for this clinic, with their prices, normal reference ranges, and critical thresholds. Each clinic has its own independent catalog.

**Inpatient pricing**
The **Inpatient** tab lets you configure daily rates per ward, as well as a nursing care rate common to all wards. These rates are applied automatically via nightly billing.

**Managing staff**
The **Staff** tab lists all active members. To invite a new member, click **Invite** — they will receive an email with a link to set their password. You can change a member's role at any time. Deactivating an account immediately revokes their active session (the member is logged out within seconds).

**Available roles**
Each role gives access to specific modules: Receptionist (reception, patients, appointments), Doctor (consultation, admissions), Nurse (triage, care, admissions), Pharmacist (pharmacy), Lab Technician (laboratory), Billing Clerk (billing), Auditor (audit log only), Admin (everything).
    `,
  },

  {
    id: 'audit-log',
    section: 'Administration', sectionEn: 'Administration',
    title: 'Comprendre le journal d\'audit',
    titleEn: 'Understanding the audit log',
    roles: ['admin', 'auditor'],
    tags: ['audit', 'journal', 'log', 'traçabilité', 'traceability', 'historique', 'history'],
    content: `
Le journal d'audit enregistre toutes les actions sensibles effectuées dans le système : invitations de personnel, changements de rôle, créations et modifications de tarifs, urgences signalées, sorties de patients, ajustements de stock, et plus encore.

**Accès**
Le journal est visible dans **Administration** → onglet **Journal d'audit**. Le rôle Auditeur y a accès en lecture seule, sans pouvoir modifier quoi que ce soit d'autre dans l'application.

**Filtrer les entrées**
Utilisez le filtre par catégorie (Personnel, Tarifs, Visites, Pharmacie, etc.) ou la barre de recherche pour trouver les événements pertinents. Cliquez **Voir les détails** sur une entrée pour voir les valeurs avant/après (par exemple, l'ancien tarif et le nouveau lors d'une modification de prix).

**Ce qui est tracé**
Chaque entrée indique : qui a effectué l'action, quand, et sur quelle entité. Les actions système (facturation nocturne automatique) apparaissent sans acteur humain.

**Ce qui n'est pas tracé**
Les consultations elles-mêmes (notes SOAP) ne sont pas dans le journal d'audit — elles sont dans le dossier du patient. Le journal couvre les actions administratives et de configuration, pas le contenu clinique.
    `,
    contentEn: `
The audit log records all sensitive actions performed in the system: staff invitations, role changes, price creations and modifications, flagged emergencies, patient discharges, stock adjustments, and more.

**Access**
The log is visible in **Administration** → **Audit Log** tab. The Auditor role has read-only access to it, without being able to modify anything else in the app.

**Filtering entries**
Use the category filter (Staff, Pricing, Visits, Pharmacy, etc.) or the search bar to find relevant events. Click **View details** on an entry to see before/after values (e.g. the old price and the new one when a price was changed).

**What is tracked**
Each entry shows: who performed the action, when, and on which entity. System actions (automatic nightly billing) appear without a human actor.

**What is not tracked**
Consultations themselves (SOAP notes) are not in the audit log — they are in the patient's record. The log covers administrative and configuration actions, not clinical content.
    `,
  },

  // ─── TROUBLESHOOTING ──────────────────────────────────────────────────────

  {
    id: 'common-errors',
    section: 'Résolution de problèmes', sectionEn: 'Troubleshooting',
    title: 'Problèmes fréquents et solutions',
    titleEn: 'Common problems and solutions',
    roles: ['admin', 'receptionist', 'doctor', 'nurse', 'pharmacist', 'lab_technician', 'billing_clerk'],
    tags: ['erreur', 'error', 'bloqué', 'stuck', 'bug', 'problème', 'problem', 'paiement', 'payment', 'stock', 'session'],
    content: `
**La visite est bloquée sur "En attente de paiement" alors que le patient a payé**
Rechargez la page. Si le statut ne change pas, un bouton **Continuer** devrait apparaître — le paiement a été enregistré mais l'écran ne s'est pas mis à jour. Cliquez Continuer.

**Je ne vois pas un patient dans la liste**
Vérifiez que vous cherchez dans la bonne clinique. Si vous êtes en charge de plusieurs cliniques, votre accès est limité à celle liée à votre compte. Contactez votre administrateur si vous pensez avoir accès à une autre clinique.

**Un médicament ne peut pas être marqué "Administré" dans le MAR**
Le médicament doit d'abord être dispensé par la pharmacie. Le bouton reste désactivé tant que la pharmacie n'a pas délivré au moins la dose à administrer.

**Mon compte a été désactivé**
Contactez votre administrateur de clinique. Seul un administrateur peut réactiver un compte.

**L'invitation n'a pas été reçue**
Vérifiez le dossier spam. Si l'email n'est pas là, l'administrateur peut vérifier que l'adresse saisie est correcte et renvoyer l'invitation depuis le panneau Personnel.

**Un tarif de service ne peut pas être créé (erreur "service_code")**
Chaque service doit avoir un code unique. Le code est généré automatiquement depuis le nom — si deux services ont des noms similaires, modifiez manuellement le code proposé pour le rendre unique.

**Les résultats de laboratoire n'apparaissent pas chez le médecin**
Les résultats ne sont visibles qu'une fois **validés** par le technicien de laboratoire. Les résultats saisis mais non validés restent en attente.
    `,
    contentEn: `
**The visit is stuck on "Awaiting payment" even though the patient has paid**
Reload the page. If the status doesn't change, a **Continue** button should appear — the payment was registered but the screen didn't update. Click Continue.

**I can't find a patient in the list**
Check that you're searching in the correct clinic. If you manage multiple clinics, your access is limited to the one linked to your account. Contact your administrator if you believe you should have access to another clinic.

**A medication can't be marked "Administered" in the MAR**
The medication must first be dispensed by the pharmacy. The button stays disabled until the pharmacy has delivered at least the dose to be administered.

**My account has been deactivated**
Contact your clinic administrator. Only an administrator can reactivate an account.

**The invitation email was not received**
Check the spam folder. If the email isn't there, the administrator can verify the entered address is correct and resend the invitation from the Staff panel.

**A service price can't be created (service_code error)**
Each service must have a unique code. The code is auto-generated from the name — if two services have similar names, manually edit the suggested code to make it unique.

**Lab results don't appear for the doctor**
Results are only visible once **verified** by the lab technician. Results entered but not verified remain pending.
    `,
  },

  // ─── PRINT ────────────────────────────────────────────────────────────────

  {
    id: 'printing',
    section: 'Impressions', sectionEn: 'Printing',
    title: 'Imprimer les documents officiels',
    titleEn: 'Printing official documents',
    roles: ['admin', 'receptionist', 'doctor', 'pharmacist', 'nurse', 'billing_clerk'],
    tags: ['imprimer', 'print', 'reçu', 'receipt', 'ordonnance', 'prescription', 'compte-rendu', 'consultation report', 'résumé', 'discharge', 'labo', 'lab', 'étiquette', 'label', 'bilingue', 'bilingual'],
    content: `
Tous les documents imprimables sont accessibles depuis la fiche du patient ou depuis l'historique de la transaction concernée. Cliquez le lien **Imprimer** pour ouvrir une page d'impression dédiée, puis utilisez **Ctrl+P** (ou Cmd+P sur Mac) pour imprimer ou enregistrer en PDF.

**Documents disponibles**
- **Reçu de paiement** — depuis un paiement finalisé
- **Reçu de vente** — depuis une vente au comptoir (pharmacie POS)
- **Ordonnance médicale** — depuis une consultation terminée
- **Compte-rendu de consultation** — depuis une consultation terminée
- **Rapport de laboratoire** — depuis les résultats de laboratoire validés
- **Étiquette médicament** — depuis un article dispensé
- **Résumé de sortie** — depuis un dossier d'hospitalisation clôturé

**Format bilingue**
Tous les documents imprimables affichent les libellés en **Français et en English** simultanément, conformément au statut bilingue officiel du Cameroun. Les données du patient (nom, diagnostic, résultats) restent dans la langue de saisie.

**Adapter l'impression**
Dans la boîte de dialogue d'impression de votre navigateur, désactivez "En-têtes et pieds de page" pour un rendu plus propre. Pour les étiquettes médicaments, imprimez sur papier A4 et découpez selon le cadre.
    `,
    contentEn: `
All printable documents are accessible from the patient's record or from the history of the relevant transaction. Click the **Print** link to open a dedicated print page, then use **Ctrl+P** (or Cmd+P on Mac) to print or save as PDF.

**Available documents**
- **Payment receipt** — from a finalised payment
- **Sales receipt** — from a counter sale (pharmacy POS)
- **Medical prescription** — from a completed consultation
- **Consultation report** — from a completed consultation
- **Laboratory report** — from verified laboratory results
- **Medication label** — from a dispensed item
- **Discharge summary** — from a closed inpatient record

**Bilingual format**
All printable documents display labels in **French and English** simultaneously, in accordance with Cameroon's official bilingual status. Patient data (name, diagnosis, results) remains in the language it was entered in.

**Adjusting the print**
In your browser's print dialog, disable "Headers and footers" for a cleaner output. For medication labels, print on A4 paper and cut along the frame.
    `,
  },
]

export function getArticlesForRole(role: StaffRole): DocArticle[] {
  return DOC_ARTICLES.filter(a => a.roles.includes(role))
}

export function getSectionsForRole(role: StaffRole, lang: 'fr' | 'en'): Array<{ title: string; articles: DocArticle[] }> {
  const articles = getArticlesForRole(role)
  const sectionMap = new Map<string, DocArticle[]>()
  for (const a of articles) {
    const key = lang === 'fr' ? a.section : a.sectionEn
    if (!sectionMap.has(key)) sectionMap.set(key, [])
    sectionMap.get(key)!.push(a)
  }
  return Array.from(sectionMap.entries()).map(([title, arts]) => ({ title, articles: arts }))
}
