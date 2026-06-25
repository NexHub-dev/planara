"use strict";

const app = document.querySelector("#app");
const modal = document.querySelector("#modal");
const modalContent = document.querySelector("#modal-content");
const toastRoot = document.querySelector("#toast-root");

const state = {
  me: null,
  users: [],
  groups: [],
  areas: [],
  tasks: [],
  ideas: [],
  bugs: [],
  changelogs: [],
  archivedChangelogs: [],
  permissionCatalog: [],
  settings: {},
  demoAvailable: false,
  oauthConfigured: false,
  loginPromptActive: false,
  page: "dashboard",
  taskSearch: "",
  taskPriority: "alle",
  taskArea: "alle",
  taskScope: null,
  taskScopeUserId: null,
  taskScopeHasAreas: null,
  statuses: [],
  branding: {},
  apiTokens: [],
  locale: "en",
  localAuth: true,
  registrationOpen: true,
  setupRequired: false,
  update: null
};

const dragState = {
  taskId: null,
  sourceStatus: null,
  pointerId: null,
  ghost: null,
  card: null,
  moved: false,
  suppressClickUntil: 0
};

const tutorial = {
  active: false,
  index: 0,
  steps: [],
  renderToken: 0
};

let statusConfig = {
  starting: { label: "Start", color: "#64748b", isDone: false },
  planung: { label: "Planung", color: "#6d5dfc", isDone: false },
  entwicklung: { label: "Entwicklung", color: "#0ea5e9", isDone: false },
  testing: { label: "Testing", color: "#f59e0b", isDone: false },
  abgeschlossen: { label: "Abgeschlossen", color: "#22c55e", isDone: true }
};
let defaultStatusKey = "starting";

function rebuildStatusConfig() {
  const list = Array.isArray(state.statuses) ? [...state.statuses] : [];
  if (!list.length) return;
  list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  statusConfig = Object.fromEntries(
    list.map((status) => [
      status.id,
      { label: status.name, color: status.color, isDone: Boolean(status.isDone) }
    ])
  );
  defaultStatusKey = (list.find((status) => status.isDefault) || list[0]).id;
}

function isDoneStatus(statusId) {
  return Boolean(statusConfig[statusId]?.isDone);
}

const projectTypeConfig = {
  kleinprojekt: { label: "Small project", shortLabel: "Small" },
  mittelprojekt: { label: "Medium project", shortLabel: "Medium" },
  grossprojekt: { label: "Large project", shortLabel: "Large" }
};

const typeLabels = {
  hinzugefuegt: "Added",
  bearbeitet: "Bearbeitet",
  entfernt: "Entfernt"
};

const permissionLabels = {
  view_app: "View app",
  create_task: "Create tasks",
  claim_task: "Claim open tasks",
  manage_tasks: "Manage all tasks",
  submit_changelog: "Submit changelog",
  approve_changelog: "Approve changelog",
  delete_changelog: "Delete changelog",
  push_changelog: "Publish changelog",
  manage_users: "Approve users",
  manage_settings: "Manage settings"
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const translations = {
  en: {
    "login.subtitle": "Tasks, roles, statuses and changelogs in one focused, fully customizable workspace.",
    "login.point1": "Your own branding, colors and logo",
    "login.point2": "Freely definable task statuses",
    "login.point3": "Roles and permissions per team",
    "login.point4": "API access via tokens",
    "login.tab_login": "Sign in",
    "login.tab_register": "Register",
    "login.tab_admin": "Create admin",
    "login.setup_title": "First start",
    "login.setup_text": "Create the administrator account now.",
    "login.username": "Username",
    "login.password": "Password",
    "login.displayname": "Display name",
    "login.remember": "Stay signed in (30 days)",
    "login.btn_login": "Sign in",
    "login.btn_register": "Create account",
    "login.btn_create_admin": "Create administrator",
    "login.hint_approval": "New accounts must be approved before first access.",
    "login.divider_or": "or",
    "login.discord": "Continue with Discord",
    "login.demo": "Open demo",
    "login.welcome": "Welcome back",
    "login.welcome_sub": "Sign in to your workspace to continue.",
    "login.create_title": "Create your account",
    "login.create_admin_title": "Create the admin account",
    "login.create_sub": "Set up your access in a few seconds.",
    "login.no_account": "New here?",
    "login.have_account": "Already have an account?",
    "login.password_ph": "at least 8 characters",
    "nav.workspace": "Workspace",
    "nav.administration": "Administration",
    "nav.dashboard": "Overview",
    "nav.tasks": "Tasks",
    "nav.ideas": "Ideas",
    "nav.bugs": "Bugs",
    "nav.definitions": "Project definitions",
    "nav.changelog": "Changelog",
    "nav.archive": "Past changelogs",
    "nav.review": "Approvals",
    "nav.users": "Users",
    "nav.groups": "Roles & permissions",
    "nav.areas": "Areas",
    "nav.settings": "Settings",
    "top.tutorial": "Tutorial",
    "top.refresh": "Refresh",
    "top.update": "Update available",
    "pending.eyebrow": "Access pending",
    "pending.title": "Approval required",
    "pending.text": "Your account was created successfully. An administrator still needs to assign you a role before you can open the workspace.",
    "pending.refresh": "Refresh status",
    "pending.logout": "Sign out",
    "set.eyebrow": "Administration",
    "set.title": "Settings",
    "set.subtitle": "Adjust branding, task statuses and API access for your workspace.",
    "set.branding": "Branding",
    "set.custom_branding": "Custom branding",
    "set.productname": "Product name",
    "set.tagline": "Claim / tagline",
    "set.primary": "Primary color",
    "set.accent": "Accent color",
    "set.logo": "Logo path (wordmark)",
    "set.icon": "Icon path (favicon/mark)",
    "set.save_branding": "Save branding",
    "set.statuses": "Task statuses",
    "set.custom_status": "Custom status",
    "set.flag_default": "Default",
    "set.flag_done": "Done",
    "set.set_default": "Set as default",
    "set.delete": "Delete",
    "set.new_status": "New status",
    "set.done_label": "Done",
    "set.add": "Add",
    "set.api_tokens": "API tokens",
    "set.tokens_active": "{n} active",
    "set.token_note": "External access authenticates via Authorization: Bearer <token>. The plain token is shown only once.",
    "set.no_tokens": "No tokens created yet.",
    "set.token_name": "Token name",
    "set.only_read": "Read only",
    "set.read_write": "Read & write",
    "set.create_token": "Create token",
    "set.revoke": "Revoke",
    "set.scope_read": "Read only",
    "set.scope_write": "Read & write",
    "task.eyebrow": "Workflow",
    "task.title": "Tasks",
    "task.desc": "From backlog to done. Drag your own tasks between the columns.",
    "task.desc_manage": " With manage rights you can move any task.",
    "task.new": "New task",
    "task.search": "Search tasks...",
    "task.scope_own": "My tasks",
    "task.scope_areas": "My areas",
    "task.scope_areas_none": " - none assigned",
    "task.scope_all": "All tasks",
    "task.area_all": "All areas",
    "task.area_none": "General - no area",
    "task.prio_all": "All priorities",
    "task.general": "General",
    "task.yours": "Yours",
    "task.open": "Open",
    "prio.kritisch": "Critical",
    "prio.hoch": "High",
    "prio.mittel": "Medium",
    "prio.niedrig": "Low"
  },
  de: {
    "login.subtitle": "Aufgaben, Rollen, Status und Changelogs in einem fokussierten, voll anpassbaren Workspace.",
    "login.point1": "Eigenes Branding, Farben und Logo",
    "login.point2": "Frei definierbare Aufgaben-Status",
    "login.point3": "Rollen und Rechte pro Team",
    "login.point4": "API-Zugriff per Token",
    "login.tab_login": "Anmelden",
    "login.tab_register": "Registrieren",
    "login.tab_admin": "Admin anlegen",
    "login.setup_title": "Erster Start",
    "login.setup_text": "Lege jetzt das Administrator-Konto an.",
    "login.username": "Benutzername",
    "login.password": "Passwort",
    "login.displayname": "Anzeigename",
    "login.remember": "Angemeldet bleiben (30 Tage)",
    "login.btn_login": "Anmelden",
    "login.btn_register": "Konto erstellen",
    "login.btn_create_admin": "Administrator anlegen",
    "login.hint_approval": "Neue Konten werden vor dem ersten Zugriff freigeschaltet.",
    "login.divider_or": "oder",
    "login.discord": "Mit Discord fortfahren",
    "login.demo": "Demo öffnen",
    "login.welcome": "Willkommen zurück",
    "login.welcome_sub": "Melde dich an, um deinen Workspace zu öffnen.",
    "login.create_title": "Konto erstellen",
    "login.create_admin_title": "Administrator-Konto erstellen",
    "login.create_sub": "Richte deinen Zugang in wenigen Sekunden ein.",
    "login.no_account": "Neu hier?",
    "login.have_account": "Schon ein Konto?",
    "login.password_ph": "mindestens 8 Zeichen",
    "nav.workspace": "Workspace",
    "nav.administration": "Verwaltung",
    "nav.dashboard": "Übersicht",
    "nav.tasks": "Aufgaben",
    "nav.ideas": "Ideas",
    "nav.bugs": "Bugs",
    "nav.definitions": "Projektdefinitionen",
    "nav.changelog": "Changelog",
    "nav.archive": "Alte Changelogs",
    "nav.review": "Approvals",
    "nav.users": "Nutzer",
    "nav.groups": "Roles & permissions",
    "nav.areas": "Areas",
    "nav.settings": "Einstellungen",
    "top.tutorial": "Tutorial",
    "top.refresh": "Aktualisieren",
    "top.update": "Update verfügbar",
    "pending.eyebrow": "Zugriff ausstehend",
    "pending.title": "Freischaltung erforderlich",
    "pending.text": "Dein Account wurde erfolgreich angelegt. Ein Administrator muss dich noch einer Gruppe zuweisen, bevor du den Workspace öffnen kannst.",
    "pending.refresh": "Status aktualisieren",
    "pending.logout": "Abmelden",
    "set.eyebrow": "Verwaltung",
    "set.title": "Einstellungen",
    "set.subtitle": "Branding, Aufgaben-Status und API-Zugriff für deinen Workspace anpassen.",
    "set.branding": "Branding",
    "set.custom_branding": "Custom Branding",
    "set.productname": "Produktname",
    "set.tagline": "Claim / Tagline",
    "set.primary": "Primärfarbe",
    "set.accent": "Akzentfarbe",
    "set.logo": "Logo-Pfad (Wortmarke)",
    "set.icon": "Icon-Pfad (Favicon/Mark)",
    "set.save_branding": "Branding speichern",
    "set.statuses": "Aufgaben-Status",
    "set.custom_status": "Custom Status",
    "set.flag_default": "Standard",
    "set.flag_done": "Abschluss",
    "set.set_default": "Als Standard setzen",
    "set.delete": "Delete",
    "set.new_status": "Neuer Status",
    "set.done_label": "Abschluss",
    "set.add": "Hinzufügen",
    "set.api_tokens": "API-Tokens",
    "set.tokens_active": "{n} aktiv",
    "set.token_note": "Externe Zugriffe authentifizieren sich per Authorization: Bearer <token>. Der Klartext wird nur einmalig angezeigt.",
    "set.no_tokens": "Noch keine Tokens erstellt.",
    "set.token_name": "Token-Name",
    "set.only_read": "Nur lesen",
    "set.read_write": "Lesen & schreiben",
    "set.create_token": "Token erstellen",
    "set.revoke": "Widerrufen",
    "set.scope_read": "Nur lesen",
    "set.scope_write": "Lesen & schreiben",
    "task.eyebrow": "Arbeitsfluss",
    "task.title": "Aufgaben",
    "task.desc": "Vom Backlog bis zum Abschluss. Eigene Aufgaben per Drag & Drop verschieben.",
    "task.desc_manage": " Mit Verwaltungsrecht kannst du alle Aufgaben verschieben.",
    "task.new": "New task",
    "task.search": "Aufgaben durchsuchen...",
    "task.scope_own": "Meine Aufgaben",
    "task.scope_areas": "Meine Bereiche",
    "task.scope_areas_none": " - keine zugewiesen",
    "task.scope_all": "Alle Aufgaben",
    "task.area_all": "Alle Bereiche",
    "task.area_none": "Allgemein - ohne Bereich",
    "task.prio_all": "Alle Prioritäten",
    "task.general": "Allgemein",
    "task.yours": "Deine",
    "task.open": "Offen",
    "prio.kritisch": "Kritisch",
    "prio.hoch": "Wichtig",
    "prio.mittel": "Mittel",
    "prio.niedrig": "Unwichtig"
  }
};

function t(key, vars) {
  const lang = state.locale === "de" ? "de" : "en";
  let text = (translations[lang] && translations[lang][key]) || translations.en[key] || key;
  if (vars) {
    for (const name of Object.keys(vars)) {
      text = text.replaceAll(`{${name}}`, String(vars[name]));
    }
  }
  return text;
}

const deDict = {
  "Approvals": "Freigaben",
  "Progress": "Fortschritt",
  "Planning": "Planung",
  "In Progress": "In Bearbeitung",
  "Done": "Fertig",
  "Small project": "Kleinprojekt",
  "Medium project": "Mittleres Projekt",
  "Large project": "Großprojekt",
  "Small": "Klein",
  "Medium": "Mittel",
  "Large": "Groß",
  "Cancel": "Abbrechen",
  "Back": "Zurück",
  "Delete": "Löschen",
  "Delete permanently": "Endgültig löschen",
  "Save changes": "Änderungen speichern",
  "Save note": "Notiz speichern",
  "Save status": "Status speichern",
  "Save date": "Datum speichern",
  "Save area": "Bereich speichern",
  "Create task": "Aufgabe erstellen",
  "New task": "Neue Aufgabe",
  "Report bug": "Bug melden",
  "Submit idea": "Idee einreichen",
  "New entry": "Eintrag erstellen",
  "New role": "Neue Gruppe",
  "New area": "Neuer Bereich",
  "Webhook push": "Webhook Push",
  "Create as task": "Als Aufgabe anlegen",
  "Delete task": "Aufgabe löschen",
  "Claim task": "Aufgabe übernehmen",
  "Delete task?": "Aufgabe löschen?",
  "Delete area?": "Bereich löschen?",
  "Delete role?": "Gruppe löschen?",
  "Delete changelog entry?": "Changelog-Eintrag löschen?",
  "Change status": "Status ändern",
  "Change area": "Bereich ändern",
  "Edit area": "Bereich bearbeiten",
  "Create area": "Bereich erstellen",
  "Edit role": "Gruppe bearbeiten",
  "Edit changelog": "Changelog bearbeiten",
  "Edit access": "Zugriff bearbeiten",
  "Change task status": "Aufgabenstatus ändern",
  "Change task area": "Aufgabenbereich ändern",
  "Choose file": "Datei auswählen",
  "Choose images": "Bilder auswählen",
  "Open image": "Bild öffnen",
  "Your idea": "Deine Idee",
  "New note": "Neue Notiz",
  "Notes": "Notizen",
  "History": "Verlauf",
  "Area": "Bereich",
  "Areas": "Bereiche",
  "Priority": "Priorität",
  "Project size": "Projektgröße",
  "Assignee": "Zuständig",
  "No date": "Kein Datum",
  "Ideas": "Ideen",
  "Bug reports": "Bug-Reports",
  "Changelog approvals": "Changelog-Freigaben",
  "Roles & permissions": "Gruppen & Rechte",
  "Users & permissions": "Nutzer & Rechte",
  "Project overview": "Projektübersicht",
  "Published": "Veröffentlicht",
  "Releases": "Veröffentlichungen",
  "Included permissions": "Enthaltene Rechte",
  "What changed?": "Was wurde gemacht?",
  "Webhook missing": "Webhook fehlt",
  "All reviewed": "Alles geprüft",
  "Review pending": "Prüfung ausstehend",
  "Recent changelog activity": "Letzte Changelog-Aktivität",
  "Upcoming deadlines": "Nächste Termine",
  "Due dates": "Fälligkeitsdaten",
  "Last webhook push": "Letzter Webhook Push",
  "No release yet": "Noch keine Veröffentlichung",
  "Current changelog is empty": "Aktueller Changelog ist leer",
  "Suggestions from the team": "Vorschläge aus dem Team",
  "Goal and requirements of the task": "Ziel und Anforderungen der Aufgabe",
  "Original idea": "Ursprüngliche Idee",
  "Original bug report": "Ursprünglicher Bug-Report",
  "Linked task no longer exists": "Verknüpfte Aufgabe nicht mehr vorhanden",
  "Short, clear description": "Kurze, verständliche Beschreibung",
  "Added": "Hinzugefügt",
  "Change": "Änderung",
  "Small project": "Kleinprojekt",
  "Medium project": "Mittleres Projekt",
  "Large project": "Großprojekt",
  "Small": "Klein",
  "Medium": "Mittel",
  "Large": "Groß",
  "No tasks yet": "Noch keine Aufgabe",
  "No areas yet": "Noch keine Bereiche",
  "No bugs reported yet": "Noch keine Bugs gemeldet",
  "No ideas yet": "Noch keine Ideen",
  "No members yet": "Noch keine Mitglieder",
  "No notes on this task yet.": "Noch keine Notizen zu dieser Aufgabe.",
  "No permissions": "Keine Funktionsrechte",
  "This task still needs an owner": "Für diese Aufgabe wird noch jemand gesucht",
  "Task was assigned to you.": "Aufgabe wurde dir zugewiesen.",
  "Task was deleted.": "Aufgabe wurde gelöscht.",
  "Task area was saved.": "Aufgabenbereich wurde gespeichert.",
  "Due date was saved.": "Fertigstellungsdatum wurde gespeichert.",
  "Area was updated.": "Bereich wurde aktualisiert.",
  "Area was created.": "Bereich wurde erstellt.",
  "Area was deleted.": "Bereich wurde gelöscht.",
  "Role was updated.": "Gruppe wurde aktualisiert.",
  "Role was created.": "Gruppe wurde erstellt.",
  "Role was deleted.": "Gruppe wurde gelöscht.",
  "Idea was submitted.": "Idee wurde eingereicht.",
  "Bug report was submitted.": "Bug-Report wurde eingereicht.",
  "Note was saved.": "Notiz wurde gespeichert.",
  "User permissions were saved.": "Nutzerrechte wurden gespeichert.",
  "Data was refreshed.": "Daten wurden aktualisiert.",
  "Branding was saved.": "Branding wurde gespeichert.",
  "Status was added.": "Status wurde hinzugefügt.",
  "Status was deleted.": "Status wurde gelöscht.",
  "Default status was set.": "Standard-Status wurde gesetzt.",
  "Token was revoked.": "Token wurde widerrufen.",
  "Changelog was sent to Discord.": "Changelog wurde an Discord gesendet.",
  "Changelog entry was approved.": "Changelog-Eintrag wurde freigegeben.",
  "Changelog entry was deleted.": "Changelog-Eintrag wurde gelöscht.",
  "Entry now awaits approval.": "Eintrag wartet jetzt auf Freigabe.",
  "Entry was updated.": "Eintrag wurde überarbeitet.",
  "Access was revoked.": "Zugriff wurde entzogen.",
  "Signed in": "Anmeldung erfolgreich",
  "You stay signed in for 30 days.": "Du bleibst 30 Tage angemeldet.",
  "You are signed in for this browser session only.": "Die Anmeldung gilt nur für diese Browser-Sitzung.",
  "Do you want to stay signed in on this device after closing the browser?": "Möchtest du auf diesem Gerät auch nach dem Schließen des Browsers angemeldet bleiben?",
  "The session ends when the browser is closed.": "Die Anmeldung endet, sobald die Browser-Sitzung geschlossen wird.",
  "All ongoing work, upcoming deadlines and changelog activity at a glance.": "Alle laufenden Arbeiten, anstehenden Termine und Changelog-Aktivitäten auf einen Blick.",
  "Every approved user can add notes.": "Alle freigeschalteten Nutzer können Notizen ergänzen.",
  "Once submitted, the idea is visible to every approved user.": "Die Idee ist nach dem Absenden für alle freigeschalteten Nutzer sichtbar.",
  "Describe your suggestion so the team can understand and assess it right away.": "Beschreibe deinen Vorschlag so, dass das Team ihn direkt verstehen und einschätzen kann.",
  "The more precise the description, the faster the bug can be reproduced and fixed.": "Je genauer die Beschreibung ist, desto schneller lässt sich der Fehler reproduzieren und beheben.",
  "Move the task straight into the desired status column.": "Verschiebe die Aufgabe direkt in die gewünschte Status-Zone.",
  "Only the areas you are assigned to are available.": "Zur Auswahl stehen nur die Bereiche, denen du selbst zugewiesen bist.",
  "You can move your task into one of your areas or keep it as a general task.": "Du kannst deine Aufgabe in einen deiner Bereiche verschieben oder wieder als allgemeine Aufgabe führen.",
  "You are assigned to this task and decide when you expect to finish it.": "Du bist dieser Aufgabe zugewiesen und legst fest, bis wann du sie voraussichtlich fertigstellst.",
  "Discord shows this time to every user in their local time zone.": "Discord zeigt diese Zeit jedem Nutzer automatisch in dessen lokaler Zeitzone.",
  "Areas connect users with the tasks they may take on.": "Bereiche verbinden Nutzer mit den Aufgaben, die sie übernehmen dürfen.",
  "Areas structure tasks and can be assigned to each user multiple times.": "Bereiche strukturieren Aufgaben und können jedem Nutzer mehrfach zugewiesen werden.",
  "Create the first area and then assign it to users and tasks.": "Lege den ersten Bereich an und weise ihn anschließend Nutzern und Aufgaben zu.",
  "No areas have been created yet. Without an area a user sees all tasks by default.": "Es wurden noch keine Bereiche angelegt. Ohne Bereich sieht der Nutzer standardmäßig alle Aufgaben.",
  "Only users belonging to the selected area are shown.": "Es werden nur Nutzer angezeigt, die dem gewählten Bereich angehören.",
  "User may take on tasks of this area.": "Nutzer darf Aufgaben dieses Bereichs übernehmen.",
  "Create roles freely and equip them with the available permissions.": "Gruppen frei anlegen, gestalten und mit den verfügbaren Funktionsrechten ausstatten.",
  "Choose the permissions that all members of this role should receive.": "Wähle die Funktionsrechte, die alle Mitglieder dieser Gruppe erhalten sollen.",
  "Approve new users and assign roles and multiple areas.": "Neue Discord-Nutzer freischalten sowie Gruppen und mehrere Arbeitsbereiche zuweisen.",
  "Submit the first suggestion for the team.": "Reiche den ersten Vorschlag für das Team ein.",
  "New reports appear here together.": "Neue Reports erscheinen gesammelt an dieser Stelle.",
  "Review entries, refine the wording and approve them for the next webhook push.": "Einträge prüfen, sprachlich überarbeiten und anschließend für den nächsten Webhook Push freigeben.",
  "Fix the wording and prepare the entry for approval.": "Formulierung korrigieren und den Eintrag zur Freigabe vorbereiten.",
  "No changelog entries are awaiting approval right now.": "Momentan warten keine Changelog-Einträge auf eine Freigabe.",
  "Unapproved entries are visible to everyone and marked with a red X.": "Nicht freigegebene Einträge sind für alle sichtbar und mit einem roten X markiert.",
  "The entry is visible immediately and stays marked with an X until approved.": "Der Eintrag ist sofort sichtbar und bleibt bis zur EL-Freigabe mit X markiert.",
  "After the first changelog push the release appears here.": "Nach dem ersten Changelog Push erscheint die Veröffentlichung hier.",
  "No changelog has been published yet.": "Es wurde noch kein Changelog veröffentlicht.",
  "Every changelog already published via Discord webhook stays here permanently.": "Alle bereits per Discord Webhook veröffentlichten Changelogs bleiben hier dauerhaft nachvollziehbar.",
  "After a push you can find the published entries under „Past changelogs“.": "Nach einem Push findest du die veröffentlichten Einträge unter „Alte Changelogs“.",
  "Before the push every entry has to be approved by the lead.": "Vor dem Push müssen alle Einträge durch die Entwicklungsleitung freigegeben werden.",
  "Changelog applies from the restart at": "Changelog gilt ab Restart um",
  "Project size depends on difficulty, technical scope, risk of bugs and the required testing effort.": "Die Projektgröße richtet sich nach Schwierigkeit, technischem Umfang, Fehlerrisiko und notwendigem Testaufwand.",
  "Classify by the actual effort": "Nach dem tatsächlichen Aufwand einstufen",
  "Small: regular fixes · Medium: small custom scripts · Large: extensive systems": "Klein: normale Fixes · Mittel: kleine eigene Skripte · Groß: umfangreiche Systeme",
  "Smaller custom scripts or standalone modules": "Eigene kleinere Skripte oder eigenständige Module",
  "Small additions to existing features": "Kleine Ergänzungen an vorhandenen Funktionen",
  "Huge custom scripts or complete new systems": "Riesige eigene Skripte oder vollständige neue Systeme",
  "Harder bugs with several possible causes": "Schwierigere Bugs mit mehreren möglichen Ursachen",
  "Many dependencies on other scripts or data": "Viele Abhängigkeiten zu anderen Skripten oder Daten",
  "Few dependencies and manageable testing effort": "Wenig Abhängigkeiten und überschaubarer Testaufwand",
  "Changes across several related features": "Änderungen an mehreren zusammenhängenden Funktionen",
  "Open tasks stay visible to everyone.": "Offene Aufgaben bleiben für alle sichtbar.",
  "The task is unassigned and can be claimed by a team member.": "Die Aufgabe ist unbesetzt und kann von einem Teammitglied übernommen werden.",
  "Copy this token now. For security reasons it is shown only once.": "Kopiere diesen Token jetzt. Aus Sicherheitsgründen wird er nur ein einziges Mal angezeigt.",
  "A task can have at most five images.": "Pro Aufgabe sind maximal fünf Bilder möglich.",
  "A task can have at most five images in total.": "Pro Aufgabe sind insgesamt maximal fünf Bilder möglich.",
  "This short tour shows you the most important areas. It adapts to your permissions and will not appear again after you finish it.": "Diese kurze Einführung zeigt dir die wichtigsten Bereiche. Sie passt sich automatisch an deine Rechte an und wird nach dem Abschluss nicht erneut eingeblendet.",
  "Here you see open tasks, upcoming deadlines, project progress and the latest changelog activity at a glance.": "Hier siehst du offene Aufgaben, anstehende Termine, den Projektfortschritt und die letzten Changelog-Aktivitäten auf einen Blick.",
  "Tasks move from planning to done across these columns. Your tasks appear at the top, unassigned tasks are marked as „needs owner“ and can be claimed with the right permissions.": "Aufgaben laufen von der Planung bis zum Abschluss durch diese Spalten. Deine Aufgaben stehen oben, unbesetzte Aufgaben sind als „Person gesucht“ markiert und können mit den passenden Rechten übernommen werden.",
  "Open a card for roadmap, priority and project type. The assignee sets the due date and can keep notes on the task together with the lead.": "Öffne eine Karte für Fahrplan, Priorität und Projekttyp. Die zugewiesene Person trägt das Fertigstellungsdatum ein und kann gemeinsam mit der Entwicklungsleitung Notizen zur Aufgabe führen.",
  "You can drag any card into another status column. Users without manage rights can move their own assigned tasks.": "Du kannst alle Karten per Drag & Drop in eine andere Statusspalte ziehen. Nutzer ohne Verwaltungsrecht können jeweils ihre eigenen zugewiesenen Aufgaben verschieben.",
  "Every approved user can submit an idea here. People with the „Create tasks“ permission can turn it into a fully editable task.": "Jeder freigeschaltete Nutzer kann hier eine Idee einreichen. Personen mit dem Recht „Aufgaben erstellen“ können daraus direkt eine vollständig bearbeitbare Aufgabe machen.",
  "These rules help classify a task consistently. What matters is technical scope, difficulty, dependencies and testing effort.": "Diese Regeln helfen bei der einheitlichen Einordnung einer Aufgabe. Entscheidend sind technischer Umfang, Schwierigkeit, Abhängigkeiten und Testaufwand.",
  "Added, edited and removed items are collected here. A red X shows that the lead still has to review the entry.": "Hier werden hinzugefügte, bearbeitete und entfernte Inhalte gesammelt. Ein rotes X zeigt, dass die Entwicklungsleitung den Eintrag noch prüfen muss.",
  "After a webhook push the current changelog is cleared. Published versions stay in this archive permanently with their effective time.": "Nach einem Webhook Push wird der aktuelle Changelog geleert. Die veröffentlichten Versionen bleiben mit Gültigkeitszeitpunkt dauerhaft in diesem Archiv erhalten.",
  "In this section you review submitted changelogs, improve the wording and approve them for the next Discord push.": "In diesem Bereich prüfst du eingereichte Changelogs, verbesserst Formulierungen und gibst sie für den nächsten Discord Push frei.",
  "New users wait here for approval. You assign them a role and thereby their available features.": "Neue Discord-Nutzer warten hier auf ihre Freischaltung. Du weist ihnen eine Gruppe zu und bestimmst damit ihre verfügbaren Funktionen.",
  "As an administrator you can create your own roles and freely combine their permissions. Changes apply automatically to all members of the role.": "Als Administrator kannst du eigene Gruppen anlegen und deren Rechte frei zusammenstellen. Änderungen gelten automatisch für alle Mitglieder der Gruppe.",
  "Areas connect users with tasks. A user can belong to multiple areas; open tasks stay visible to everyone.": "Bereiche verbinden Nutzer mit Aufgaben. Ein Nutzer kann mehreren Bereichen angehören; offene Aufgaben bleiben trotzdem für alle sichtbar.",
  "That completes the tour. You can restart it any time via „Tutorial“ in the top right.": "Damit ist die Einführung abgeschlossen. Über „Tutorial“ oben rechts kannst du diesen Rundgang später jederzeit erneut starten.",
  "All task data can be adjusted before creation. The later status and assignee are shown automatically in the original entry.": "Alle Aufgabendaten können vor der Erstellung angepasst werden. Der spätere Status und die zugewiesene Person werden automatisch im ursprünglichen Eintrag angezeigt.",
  "Define scope, priority and the planned approach. The assignee sets the due date later.": "Definiere Umfang, Priorität und den geplanten Umsetzungsweg. Das Fertigstellungsdatum trägt später die zugewiesene Person ein.",
  "Every approved user can submit an idea. Once it becomes a task you see its status and owner right here.": "Jeder freigeschaltete Nutzer kann eine Idee einreichen. Sobald daraus eine Aufgabe entsteht, siehst du hier direkt deren Status und Zuständigkeit.",
  "Describe the affected area and the misbehavior. Images or videos are optional and may be up to 250 MB.": "Beschreibe den betroffenen Bereich und das Fehlverhalten. Bilder oder Videos sind optional und dürfen maximal 250 MB groß sein.",
  "A small project is a clearly bounded change that can be implemented and tested without major technical planning.": "Ein Kleinprojekt ist eine klar begrenzte Änderung, die ohne größere technische Planung umgesetzt und geprüft werden kann.",
  "A medium project needs a clear roadmap and several tests but stays technically well-defined.": "Ein mittleres Projekt benötigt einen nachvollziehbaren Fahrplan und mehrere Tests, bleibt aber technisch klar abgrenzbar.",
  "A large project involves a major custom build or a particularly severe bug with far-reaching technical impact.": "Ein Großprojekt umfasst eine große Eigenentwicklung oder einen besonders schweren Fehler mit weitreichenden technischen Auswirkungen.",
  "Normal fixes and configs are small. Small custom scripts and harder bugs are medium. Very large custom builds or particularly severe cross-system bugs are large projects.": "Normale Korrekturen und Configs sind klein. Eigene kleine Skripte und schwierige Fehler sind mittel. Sehr große Eigenentwicklungen oder besonders schwere, systemübergreifende Fehler werden als Großprojekt geführt.",
  "A full job system, a large inventory system, a comprehensive data migration or a critical cross-system bug.": "Vollständiges Jobsystem, großes Inventarsystem, umfassende Datenmigration oder kritischer systemübergreifender Fehler.",
  "Config changes and minor value adjustments": "Config-Änderungen und kleinere Wertanpassungen",
  "Change a config, adjust a vehicle value, fix a normal item bug or add some text.": "Config ändern, Fahrzeugwert anpassen, normalen Item-Fehler beheben oder einen Text ergänzen.",
  "receives the permissions of the selected role and can be assigned to multiple areas.": "erhält die Rechte der gewählten Gruppe und kann mehreren Bereichen zugewiesen werden.",
  "will be permanently removed. Roles in use cannot be deleted for security reasons.": "wird dauerhaft entfernt. Zugewiesene Gruppen können aus Sicherheitsgründen nicht gelöscht werden.",
  "will be permanently removed. Areas in use cannot be deleted.": "wird dauerhaft entfernt. Zugewiesene Bereiche können nicht gelöscht werden.",
  "will be permanently removed. This action cannot be undone.": "wird dauerhaft entfernt. Diese Aktion kann nicht rückgängig gemacht werden.",
  "entries reviewed by the lead.": "Einträgen wurden durch die Entwicklungsleitung geprüft.",
  "The selected file is empty.": "Die ausgewählte Datei ist leer.",
  "The media upload may be at most 250 MB.": "Der Medienupload darf maximal 250 MB groß sein.",
  "Small, medium and large projects": "Kleine, mittlere und große Projekte",
  "Tour completed.": "Einführung abgeschlossen.",
  "ready for review": "bereit zur Prüfung",
  "In testing": "Im Testing",
  "No activity yet": "Noch keine Aktivität",
  "Approval status": "Freigabestatus",
  "Your overview": "Deine Übersicht",
  "Tour · ": "Einführung · ",
  " entries": " Einträge",
  "entries": "Einträgen",
  "area?.name || \"Unknown\"": "area?.name || \"Unbekannt\"",
  " : \"anyone can claim\"}": " : \"Jeder kann übernehmen\"}",
  "1. Review idea and requirements\\n2. Plan the implementation\\n3. Build it\\n4. Test the result": "1. Idee und Anforderungen prüfen\\n2. Umsetzung planen\\n3. Entwicklung durchführen\\n4. Ergebnis testen",
  "entries are sent as a Discord embed and then moved to „Past changelogs“.": "entries werden als Discord Embed gesendet und anschließend nach „Alte Changelogs“ verschoben.",
  "Open tasks of this area stay visible to everyone. Only assigned members can claim them.": "Offene Aufgaben dieses Bereichs bleiben für alle sichtbar. Übernehmen können sie nur zugewiesene Mitglieder.",
  "Bug reports contain the affected area, a description, the importance and optionally an image or video up to 250 MB.": "Bug-Reports enthalten den betroffenen Bereich, eine Fehlerbeschreibung, die Wichtigkeit und optional ein Bild oder Video bis 250 MB.",
  "You can drag your own assigned tasks into another status column.": "Deine eigenen zugewiesenen Aufgaben kannst du per Drag & Drop in eine andere Statusspalte ziehen.",
  "The session survives a browser or server restart.": "Die Sitzung bleibt auch nach einem Browser- oder Serverneustart erhalten.",
  "Add DISCORD_WEBHOOK_URL to the server's .env file.": "Trage DISCORD_WEBHOOK_URL in der .env-Datei des Servers ein.",
  "JPEG, PNG, WebP, GIF, MP4, WebM or MOV · max 250 MB": "JPEG, PNG, WebP, GIF, MP4, WebM oder MOV · maximal 250 MB",
  "JPEG, PNG, WebP or GIF · max 5 MB per image": "JPEG, PNG, WebP oder GIF · maximal 5 MB pro Bild",
  "e.g. ox_inventory, Sultan RS or a garage system": "z. B. ox_inventory, Sultan RS oder Garagensystem",
  "Several implementation and testing steps required": "Mehrere Umsetzungs- und Testschritte notwendig",
  "High planning, coordination and testing effort": "Hoher Planungs-, Abstimmungs- und Testaufwand",
  "Normal, not particularly difficult bug fixes": "Normale, nicht besonders schwierige Bugfixes",
  "Small custom builds and serious bugs": "Kleine Eigenentwicklungen und schwere Bugs",
  "Very serious and deep bugs": "Sehr schwere und tiefgreifende Fehler",
  "Very extensive systems and bugs": "Sehr umfangreiche Systeme und Fehler",
  "Image or video is uploading...": "Bild oder Video wird hochgeladen...",
  "Lead approvals": "Freigaben der Entwicklungsleitung",
  "Normal fixes and adjustments": "Normale Fixes und Anpassungen",
  "Details, deadlines and notes": "Details, Termine und Notizen",
  "What should be done?": "Was soll umgesetzt werden?",
  "Preparing upload...": "Upload wird vorbereitet...",
  "Ideas from the whole team": "Ideen aus dem ganzen Team",
  "Not yet approved": "Noch nicht freigegeben",
  "Tasks and projects": "Aufgaben und Projekte",
  "Stay signed in for 30 days": "30 Tage angemeldet bleiben",
  "This browser session only": "Nur diese Browser-Sitzung",
  "No area · sees all by default": "Kein Bereich · Standardansicht alle",
  "General · no area": "Allgemein · kein Bereich",
  "Submit changelog": "Changelog einreichen",
  "Approve users": "Nutzer freischalten",
  "Roles and permissions": "Gruppen und Rechte",
  "Manage areas": "Bereiche verwalten",
  "API token created": "API-Token erstellt",
  "and images were uploaded": "und Bilder wurden hochgeladen",
  "Task was created": "Aufgabe wurde erstellt",
  "Submitted by ": "Eingereicht von ",
  "Reported by ": "Gemeldet von ",
  "Open tasks": "Offene Aufgaben",
  "Changelog pending": "Changelog ausstehend",
  "Hello, ": "Guten Tag, ",
  "Unassigned": "Nicht zugewiesen",
  "not yet assigned": "noch nicht zugewiesen",
  " members assigned": " Mitglieder zugewiesen",
  "Image or video": "Bild oder Video",
  " approvals missing": " Freigaben fehlen",
  " or GIF ": " oder GIF ",
  " WebM or ": " WebM oder ",
  "} users ": "} Nutzer ",
  "\"Approvals\"": "\"Freigaben\"",
  "\"Progress\"": "\"Fortschritt\"",
  "emptyInline(\"No upcoming deadlines\")": "emptyInline(\"Keine offenen Termine\")",
  "members assigned": "Mitglieder zugewiesen",
  " as a task": " als Aufgabe anlegen",
  "A small custom management script, a more complex vehicle bug or an extension of an existing system.": "Kleines eigenes Verwaltungsskript, komplexerer Fahrzeugfehler oder Erweiterung eines bestehenden Systems."
};

const dePatterns = [
  [/^Hello, (.+)$/, "Guten Tag, $1"],
  [/^Submitted by (.+)$/, "Eingereicht von $1"],
  [/^Reported by (.+)$/, "Gemeldet von $1"],
  [/^(\d+) total$/, "$1 gesamt"],
  [/^(\d+) entries$/, "$1 Einträge"],
  [/^(\d+) entry$/, "$1 Eintrag"],
  [/^(\d+) active$/, "$1 aktiv"],
  [/^(\d+) completed$/, "$1 abgeschlossen"],
  [/^(\d+) members assigned$/, "$1 Mitglieder zugewiesen"],
  [/^(.+) · (.+)$/, null]
];

function localizeDe(node) {
  if (!node) return;
  if (node.nodeType === 3) {
    const k = node.nodeValue.trim();
    if (k && deDict[k]) node.nodeValue = node.nodeValue.replace(k, deDict[k]);
    return;
  }
  if (node.nodeType !== 1) return;
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const texts = [];
  let t;
  while ((t = walker.nextNode())) texts.push(t);
  for (const tn of texts) {
    const k = tn.nodeValue.trim();
    if (!k) continue;
    if (deDict[k]) { tn.nodeValue = tn.nodeValue.replace(k, deDict[k]); continue; }
    const parts = k.split(" · ");
    if (parts.length === 2 && (deDict[parts[0]] || deDict[parts[1]])) {
      const joined = (deDict[parts[0]] || parts[0]) + " · " + (deDict[parts[1]] || parts[1]);
      tn.nodeValue = tn.nodeValue.replace(k, joined);
      continue;
    }
    for (const [re, rep] of dePatterns) {
      if (rep && re.test(k)) { tn.nodeValue = tn.nodeValue.replace(k, k.replace(re, rep)); break; }
    }
  }
  if (node.querySelectorAll) {
    for (const el of node.querySelectorAll("[placeholder],[title],[aria-label]")) {
      for (const a of ["placeholder", "title", "aria-label"]) {
        const v = el.getAttribute(a);
        if (v && deDict[v.trim()]) el.setAttribute(a, deDict[v.trim()]);
      }
    }
  }
}

const deObserver = new MutationObserver((mutations) => {
  if (state.locale !== "de") return;
  for (const m of mutations) {
    for (const added of m.addedNodes) localizeDe(added);
  }
});

function startDeLocalization() {
  for (const node of [app, modal, toastRoot]) {
    if (node) deObserver.observe(node, { childList: true, subtree: true });
  }
}
startDeLocalization();


async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "Die Anfrage ist fehlgeschlagen.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function hasPermission(permission) {
  return Boolean(state.me?.isAdmin || state.me?.permissions?.includes(permission));
}

function getUser(userId) {
  if (!userId) return undefined;
  const identifier = String(userId);
  return state.users.find((user) =>
    [user.id, user.discordId, user.username]
      .filter(Boolean)
      .some((value) => String(value) === identifier)
  );
}

function getGroup(groupId) {
  return state.groups.find((group) => group.id === groupId);
}

function getArea(areaId) {
  return state.areas.find((area) => area.id === areaId);
}

function projectTypeLabel(value, short = false) {
  const config = projectTypeConfig[value] || projectTypeConfig.kleinprojekt;
  return short ? config.shortLabel : config.label;
}

function getUserAreaIds(user = state.me) {
  return Array.isArray(user?.areaIds) ? user.areaIds : [];
}

function canClaimTask(task) {
  return !task.areaId || getUserAreaIds().includes(task.areaId);
}

function isTaskAssignedToCurrentUser(task) {
  if (!task?.assigneeId || !state.me) return false;
  const assigneeId = String(task.assigneeId);
  return [state.me.id, state.me.discordId, state.me.username]
    .filter(Boolean)
    .some((identifier) => String(identifier) === assigneeId);
}

function canMoveTask(task) {
  return Boolean(task && (hasPermission("manage_tasks") || isTaskAssignedToCurrentUser(task)));
}

function taskMatchesScope(task) {
  if (state.taskScope === "own") return isTaskAssignedToCurrentUser(task);
  if (state.taskScope === "areas") {
    return (
      isTaskAssignedToCurrentUser(task) ||
      !task.assigneeId ||
      !task.areaId ||
      getUserAreaIds().includes(task.areaId)
    );
  }
  return true;
}

function sortTasksForCurrentUser(tasks) {
  const priorityOrder = { kritisch: 0, hoch: 1, mittel: 2, niedrig: 3 };
  const rank = (task) => {
    if (isTaskAssignedToCurrentUser(task)) return 0;
    if (!task.assigneeId) return 1;
    return 2;
  };
  return [...tasks].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9) ||
      dateRank(a.dueDate) - dateRank(b.dueDate)
  );
}

function dateRank(value) {
  return value ? new Date(`${value}T12:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
}

function canDeleteChange(entry) {
  return Boolean(
    !entry.publishedAt &&
      (hasPermission("delete_changelog") ||
        (entry.authorId === state.me?.id && !entry.approved && hasPermission("submit_changelog")))
  );
}

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function avatar(user, size = "") {
  if (!user) return `<span class="avatar ${size}">?</span>`;
  if (user.avatar) {
    return `<img class="avatar ${size}" src="${escapeHtml(user.avatar)}" alt="" />`;
  }
  return `<span class="avatar ${size}">${initials(user.displayName)}</span>`;
}

function brandName() {
  return state.branding?.productName || "Planara";
}

function brandTagline() {
  return state.branding?.tagline || "";
}

function brandLogo(size = "") {
  const url = state.branding?.markUrl || "/assets/branding/planara-mark.svg";
  return `<img class="brand-logo ${size}" src="${escapeHtml(url)}" alt="${escapeHtml(brandName())}" />`;
}

function applyBranding(branding) {
  if (branding) state.branding = branding;
  const data = state.branding || {};
  const root = document.documentElement;
  if (data.primaryColor) root.style.setProperty("--brand-primary", data.primaryColor);
  if (data.accentColor) root.style.setProperty("--brand-accent", data.accentColor);
  document.title = data.productName || "Planara";
  const icon = document.querySelector("link[rel='icon']");
  if (icon && data.markUrl) icon.setAttribute("href", data.markUrl);
}

function formatDate(value, options = {}) {
  if (!value) return "No date";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    year: options.year ? "numeric" : undefined,
    ...options
  }).format(date);
}

function timeAgo(value) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "gerade eben";
  if (seconds < 3600) return `vor ${Math.floor(seconds / 60)} Min.`;
  if (seconds < 86400) return `vor ${Math.floor(seconds / 3600)} Std.`;
  return `vor ${Math.floor(seconds / 86400)} Tagen`;
}

function toast(message, type = "") {
  const element = document.createElement("div");
  element.className = `toast ${type}`;
  element.textContent = message;
  toastRoot.appendChild(element);
  setTimeout(() => element.remove(), 3600);
}

function openModal(html) {
  modalContent.innerHTML = html;
  if (!modal.open) modal.showModal();
}

function closeModal() {
  if (modal.open) modal.close();
}

function buildTutorialSteps() {
  const steps = [
    {
      page: "dashboard",
      selector: "[data-tutorial='brand']",
      title: `Willkommen bei ${brandName()}`,
      text: "This short tour shows you the most important areas. It adapts to your permissions and will not appear again after you finish it.",
      mobileMenu: true
    },
    {
      page: "dashboard",
      selector: "[data-tutorial='page-dashboard']",
      title: "Your overview",
      text: "Here you see open tasks, upcoming deadlines, project progress and the latest changelog activity at a glance."
    },
    {
      page: "tasks",
      selector: "[data-tutorial='task-board']",
      title: "Tasks and projects",
      text: "Tasks move from planning to done across these columns. Your tasks appear at the top, unassigned tasks are marked as „needs owner“ and can be claimed with the right permissions."
    },
    {
      page: "tasks",
      selector: "[data-tutorial='task-board']",
      title: "Details, deadlines and notes",
      text: "Open a card for roadmap, priority and project type. The assignee sets the due date and can keep notes on the task together with the lead."
    }
  ];

  steps.push({
    page: "tasks",
    selector: "[data-tutorial='task-board']",
    title: "Aufgaben verschieben",
    text: hasPermission("manage_tasks")
      ? "You can drag any card into another status column. Users without manage rights can move their own assigned tasks."
      : "You can drag your own assigned tasks into another status column."
  });

  steps.push(
    {
      page: "ideas",
      selector: "[data-tutorial='page-ideas']",
      title: "Ideas from the whole team",
      text: "Every approved user can submit an idea here. People with the „Create tasks“ permission can turn it into a fully editable task."
    },
    {
      page: "bugs",
      selector: "[data-tutorial='page-bugs']",
      title: "Bugs nachvollziehbar melden",
      text: "Bug reports contain the affected area, a description, the importance and optionally an image or video up to 250 MB."
    },
    {
      page: "definitions",
      selector: "[data-tutorial='page-definitions']",
      title: "Small, medium and large projects",
      text: "These rules help classify a task consistently. What matters is technical scope, difficulty, dependencies and testing effort."
    }
  );

  steps.push(
    {
      page: "changelog",
      selector: "[data-tutorial='page-changelog']",
      title: "Submit changelog",
      text: "Added, edited and removed items are collected here. A red X shows that the lead still has to review the entry."
    },
    {
      page: "archive",
      selector: "[data-tutorial='page-archive']",
      title: "Alte Changelogs",
      text: "After a webhook push the current changelog is cleared. Published versions stay in this archive permanently with their effective time."
    }
  );

  if (hasPermission("approve_changelog")) {
    steps.push({
      page: "review",
      selector: "[data-tutorial='page-review']",
      title: "Lead approvals",
      text: "In this section you review submitted changelogs, improve the wording and approve them for the next Discord push."
    });
  }

  if (hasPermission("manage_users")) {
    steps.push({
      page: "users",
      selector: "[data-tutorial='page-users']",
      title: "Approve users",
      text: "New users wait here for approval. You assign them a role and thereby their available features."
    });
  }

  if (state.me?.isAdmin) {
    steps.push({
      page: "groups",
      selector: "[data-tutorial='page-groups']",
      title: "Roles and permissions",
      text: "As an administrator you can create your own roles and freely combine their permissions. Changes apply automatically to all members of the role."
    });
    steps.push({
      page: "areas",
      selector: "[data-tutorial='page-areas']",
      title: "Manage areas",
      text: "Areas connect users with tasks. A user can belong to multiple areas; open tasks stay visible to everyone."
    });
  }

  steps.push({
    page: "dashboard",
    selector: "[data-action='start-tutorial']",
    title: "Alles bereit",
    text: "That completes the tour. You can restart it any time via „Tutorial“ in the top right."
  });
  return steps;
}

function maybeStartTutorial() {
  if (
    state.me?.approved &&
    !state.loginPromptActive &&
    !state.me.tutorialCompletedAt &&
    !tutorial.active
  ) {
    startTutorial();
  }
}

function startTutorial() {
  closeModal();
  tutorial.active = true;
  tutorial.index = 0;
  tutorial.steps = buildTutorialSteps();
  document.body.classList.add("tutorial-active");
  renderTutorialStep();
}

function removeTutorialLayer() {
  tutorial.renderToken += 1;
  document.querySelector("#tutorial-layer")?.remove();
  document.body.classList.remove("tutorial-active", "menu-open");
}

function ensureTutorialLayer() {
  let layer = document.querySelector("#tutorial-layer");
  if (layer) return layer;
  layer = document.createElement("div");
  layer.id = "tutorial-layer";
  layer.className = "tutorial-layer";
  layer.innerHTML = `
    <div class="tutorial-shade tutorial-shade-top"></div>
    <div class="tutorial-shade tutorial-shade-left"></div>
    <div class="tutorial-shade tutorial-shade-right"></div>
    <div class="tutorial-shade tutorial-shade-bottom"></div>
    <div class="tutorial-focus"></div>
    <section class="tutorial-popup" role="dialog" aria-modal="true" aria-live="polite"></section>
  `;
  document.body.appendChild(layer);
  return layer;
}

function setTutorialRect(element, styles) {
  Object.assign(element.style, styles);
}

function positionTutorialLayer(layer, target) {
  const padding = 8;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const source = target.getBoundingClientRect();
  const rect = {
    left: Math.max(8, source.left - padding),
    top: Math.max(8, source.top - padding),
    right: Math.min(viewportWidth - 8, source.right + padding),
    bottom: Math.min(viewportHeight - 8, source.bottom + padding)
  };
  rect.width = Math.max(0, rect.right - rect.left);
  rect.height = Math.max(0, rect.bottom - rect.top);

  setTutorialRect(layer.querySelector(".tutorial-shade-top"), {
    left: "0px",
    top: "0px",
    width: "100vw",
    height: `${rect.top}px`
  });
  setTutorialRect(layer.querySelector(".tutorial-shade-left"), {
    left: "0px",
    top: `${rect.top}px`,
    width: `${rect.left}px`,
    height: `${rect.height}px`
  });
  setTutorialRect(layer.querySelector(".tutorial-shade-right"), {
    left: `${rect.right}px`,
    top: `${rect.top}px`,
    width: `${Math.max(0, viewportWidth - rect.right)}px`,
    height: `${rect.height}px`
  });
  setTutorialRect(layer.querySelector(".tutorial-shade-bottom"), {
    left: "0px",
    top: `${rect.bottom}px`,
    width: "100vw",
    height: `${Math.max(0, viewportHeight - rect.bottom)}px`
  });
  setTutorialRect(layer.querySelector(".tutorial-focus"), {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`
  });

  const popup = layer.querySelector(".tutorial-popup");
  const gap = 18;
  const popupWidth = Math.min(380, viewportWidth - 24);
  popup.style.width = `${popupWidth}px`;
  popup.style.left = "12px";
  popup.style.top = "12px";
  const popupHeight = popup.getBoundingClientRect().height;
  let left;
  let top;

  if (rect.right + gap + popupWidth <= viewportWidth - 12) {
    left = rect.right + gap;
    top = rect.top;
  } else if (rect.left - gap - popupWidth >= 12) {
    left = rect.left - gap - popupWidth;
    top = rect.top;
  } else {
    left = Math.min(Math.max(12, rect.left), viewportWidth - popupWidth - 12);
    top =
      rect.bottom + gap + popupHeight <= viewportHeight - 12
        ? rect.bottom + gap
        : rect.top - gap - popupHeight;
  }

  popup.style.left = `${Math.min(Math.max(12, left), viewportWidth - popupWidth - 12)}px`;
  popup.style.top = `${Math.min(Math.max(12, top), viewportHeight - popupHeight - 12)}px`;
}

function renderTutorialStep() {
  if (!tutorial.active) return;
  const step = tutorial.steps[tutorial.index];
  if (!step) return;
  const renderToken = ++tutorial.renderToken;

  if (state.page !== step.page) {
    state.page = step.page;
    renderShell();
  }
  if (window.innerWidth <= 760 && step.mobileMenu) {
    document.body.classList.add("menu-open");
  } else {
    document.body.classList.remove("menu-open");
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!tutorial.active || renderToken !== tutorial.renderToken) return;
      const target = document.querySelector(step.selector);
      if (!target) {
        tutorial.index += 1;
        renderTutorialStep();
        return;
      }
      target.scrollIntoView({ behavior: "auto", block: "center", inline: "center" });
      const layer = ensureTutorialLayer();
      const popup = layer.querySelector(".tutorial-popup");
      const isLast = tutorial.index === tutorial.steps.length - 1;
      popup.innerHTML = `
        <div class="tutorial-kicker">Tour · ${tutorial.index + 1} von ${tutorial.steps.length}</div>
        <h2>${escapeHtml(step.title)}</h2>
        <p>${escapeHtml(step.text)}</p>
        <div class="tutorial-progress" aria-hidden="true">
          ${tutorial.steps.map((_, index) => `<i class="${index <= tutorial.index ? "active" : ""}"></i>`).join("")}
        </div>
        <div class="tutorial-actions">
          <button class="button ghost" data-action="tutorial-back" ${tutorial.index === 0 ? "disabled" : ""}>Back</button>
          <button class="button primary" data-action="${isLast ? "tutorial-finish" : "tutorial-next"}">${isLast ? "Finish tour" : "Next"}</button>
        </div>
      `;
      positionTutorialLayer(layer, target);
      popup.querySelector(".button.primary")?.focus({ preventScroll: true });
    });
  });
}

async function finishTutorial() {
  const result = await api("/api/tutorial/complete", { method: "POST", body: "{}" });
  state.me = result.user;
  tutorial.active = false;
  removeTutorialLayer();
  state.page = "dashboard";
  renderShell();
  toast("Tour completed.");
}

function iconSvg(name) {
  const icons = {
    dashboard: "fa-table-columns",
    tasks: "fa-list-check",
    ideas: "fa-lightbulb",
    bugs: "fa-bug",
    definitions: "fa-layer-group",
    changelog: "fa-clock-rotate-left",
    archive: "fa-box-archive",
    review: "fa-circle-check",
    users: "fa-users",
    groups: "fa-shield-halved",
    areas: "fa-table-cells-large",
    testing: "fa-flask",
    progress: "fa-chart-simple",
    refresh: "fa-arrows-rotate",
    menu: "fa-bars",
    drag: "fa-grip-vertical",
    plus: "fa-plus",
    settings: "fa-gear",
    rocket: "fa-rocket"
  };
  const cls = icons[name];
  return cls ? `<i class="fa-solid ${cls}" aria-hidden="true"></i>` : "";
}

function pageTitle() {
  return {
    dashboard: t("nav.dashboard"),
    tasks: t("nav.tasks"),
    ideas: t("nav.ideas"),
    bugs: t("nav.bugs"),
    definitions: t("nav.definitions"),
    changelog: t("nav.changelog"),
    archive: t("nav.archive"),
    review: t("nav.review"),
    users: t("nav.users"),
    groups: t("nav.groups"),
    areas: t("nav.areas"),
    settings: t("nav.settings")
  }[state.page];
}

async function initialize() {
  const params = new URLSearchParams(location.search);
  const showLoginPrompt = params.get("loginPrompt") === "1";
  state.loginPromptActive = showLoginPrompt;
  if (params.get("authError")) {
    toast(params.get("authError"), "error");
    history.replaceState({}, "", "/");
  }
  try {
    const session = await api("/api/me");
    state.me = session.user;
    state.demoAvailable = session.demoAvailable;
    state.oauthConfigured = session.oauthConfigured;
    state.localAuth = session.localAuth !== false;
    state.registrationOpen = Boolean(session.registrationOpen);
    state.setupRequired = Boolean(session.setupRequired);
    state.locale = session.locale === "de" ? "de" : "en";
    document.documentElement.lang = state.locale;
    applyBranding(session.branding);
    if (!state.me) {
      state.loginPromptActive = false;
      renderLogin();
      return;
    }
    if (!state.me.approved) {
      renderPending();
      if (showLoginPrompt) {
        history.replaceState({}, "", "/");
        showRememberLoginPrompt();
      }
      return;
    }
    await refreshData();
    if (showLoginPrompt) {
      history.replaceState({}, "", "/");
      showRememberLoginPrompt();
    }
  } catch (error) {
    app.innerHTML = `<div class="pending-layout"><div class="pending-card"><h1>Verbindung fehlgeschlagen</h1><p>${escapeHtml(error.message)}</p></div></div>`;
  }
}

async function refreshData() {
  const payload = await api("/api/bootstrap");
  Object.assign(state, payload);
  if (payload.locale) {
    state.locale = payload.locale === "de" ? "de" : "en";
    document.documentElement.lang = state.locale;
  }
  rebuildStatusConfig();
  applyBranding(payload.branding);
  if (
    !["alle", "allgemein"].includes(state.taskArea) &&
    !payload.areas.some((area) => area.id === state.taskArea)
  ) {
    state.taskArea = "alle";
  }
  const hasAreas = getUserAreaIds(payload.me).length > 0;
  if (state.taskScopeUserId !== payload.me.id || state.taskScopeHasAreas !== hasAreas) {
    state.taskScope = "all";
    state.taskScopeUserId = payload.me.id;
    state.taskScopeHasAreas = hasAreas;
  }
  renderShell();
  liveSignature = dataSignature(payload);
  startLivePolling();
  setTimeout(maybeStartTutorial, 180);
}

let liveSignature = "";
let livePollTimer = null;
function dataSignature(payload) {
  const parts = [];
  for (const key of ["tasks", "ideas", "bugs", "changelogs", "archivedChangelogs", "users", "groups", "areas", "statuses"]) {
    const arr = payload[key] || [];
    parts.push(key + arr.length + arr.map((x) => (x.updatedAt || x.createdAt || "") + x.id).join("~"));
  }
  return parts.join("|");
}
async function pollLiveUpdates() {
  if (!state.me || !state.me.approved) return;
  if (modal.open) return;
  const active = document.activeElement;
  if (active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)) return;
  if (document.body.classList.contains("menu-open") || tutorial.active) return;
  try {
    const payload = await api("/api/bootstrap");
    const sig = dataSignature(payload);
    if (sig === liveSignature) return;
    liveSignature = sig;
    Object.assign(state, payload);
    rebuildStatusConfig();
    applyBranding(payload.branding);
    softUpdateView();
  } catch (error) {
    return;
  }
}

function softUpdateView() {
  const content = document.querySelector(".content");
  if (!content) {
    renderShell();
    return;
  }
  const scrollY = window.scrollY;
  const board = document.querySelector(".board");
  const boardLeft = board ? board.scrollLeft : 0;
  content.innerHTML = renderPage();
  document.querySelectorAll(".sidebar .nav-button").forEach((btn) => {
    const page = btn.dataset.page;
    let count = 0;
    if (page === "ideas") count = state.ideas.filter((i) => !i.taskId).length;
    else if (page === "bugs") count = state.bugs.filter((b) => !b.taskId).length;
    else if (page === "review") count = state.changelogs.filter((c) => !c.approved).length;
    else if (page === "users") count = state.users.filter((u) => !u.approved).length;
    else return;
    let badge = btn.querySelector(".nav-badge");
    if (count && !badge) {
      badge = document.createElement("span");
      badge.className = "nav-badge";
      btn.appendChild(badge);
    }
    if (badge) {
      if (count) badge.textContent = count;
      else badge.remove();
    }
  });
  window.scrollTo({ top: scrollY });
  const newBoard = document.querySelector(".board");
  if (newBoard) newBoard.scrollLeft = boardLeft;
}
function startLivePolling() {
  if (livePollTimer) clearInterval(livePollTimer);
  livePollTimer = setInterval(pollLiveUpdates, 5000);
}

function renderLogin() {
  const setup = state.setupRequired;
  const discord = state.oauthConfigured;
  const demo = state.demoAvailable;
  const social =
    discord || demo
      ? `
        <div class="auth-divider"><span>${t("login.divider_or")}</span></div>
        <div class="auth-social">
          ${discord ? `<button class="auth-oauth" type="button" data-action="discord-login">${t("login.discord")}</button>` : ""}
          ${demo ? `<button class="auth-oauth" type="button" data-action="demo-login">${t("login.demo")}</button>` : ""}
        </div>`
      : "";
  app.innerHTML = `
    <main class="auth">
      <aside class="auth-brandpanel">
        <div class="auth-wordmark">${brandLogo()}<span>${escapeHtml(brandName())}</span></div>
        <div class="auth-brandpanel-mid">
          <h2>${escapeHtml(brandTagline() || brandName())}</h2>
          <p>${t("login.subtitle")}</p>
          <ul class="auth-points">
            <li>${t("login.point1")}</li>
            <li>${t("login.point2")}</li>
            <li>${t("login.point3")}</li>
            <li>${t("login.point4")}</li>
          </ul>
        </div>
        <div class="auth-brandpanel-bot">© ${new Date().getFullYear()} ${escapeHtml(brandName())}</div>
      </aside>

      <section class="auth-formpanel">
        <div class="auth-box">
          <div class="auth-mobilebrand">${brandLogo()}<span>${escapeHtml(brandName())}</span></div>

          <div class="auth-pane" data-auth-panel="login">
            <h1>${t("login.welcome")}</h1>
            <p class="auth-lead">${t("login.welcome_sub")}</p>
            <form id="login-form" class="auth-form">
              <label class="ifield"><span>${t("login.username")}</span><input name="username" autocomplete="username" required maxlength="32" placeholder="username" /></label>
              <label class="ifield"><span>${t("login.password")}</span><input name="password" type="password" autocomplete="current-password" required placeholder="••••••••" /></label>
              <label class="auth-remember"><input type="checkbox" name="remember" /><span>${t("login.remember")}</span></label>
              <button type="submit" class="auth-submit">${t("login.btn_login")}</button>
            </form>
            ${social}
            <p class="auth-switch">${t("login.no_account")} <button type="button" class="auth-link" data-auth-tab="register">${setup ? t("login.tab_admin") : t("login.tab_register")}</button></p>
          </div>

          <div class="auth-pane" data-auth-panel="register" hidden>
            <h1>${setup ? t("login.create_admin_title") : t("login.create_title")}</h1>
            <p class="auth-lead">${setup ? t("login.setup_text") : t("login.create_sub")}</p>
            <form id="register-form" class="auth-form">
              <label class="ifield"><span>${t("login.displayname")}</span><input name="displayName" autocomplete="name" maxlength="60" placeholder="Jane Doe" /></label>
              <label class="ifield"><span>${t("login.username")}</span><input name="username" autocomplete="username" required maxlength="32" placeholder="username" /></label>
              <label class="ifield"><span>${t("login.password")}</span><input name="password" type="password" autocomplete="new-password" minlength="8" required placeholder="${t("login.password_ph")}" /></label>
              <label class="auth-remember"><input type="checkbox" name="remember" /><span>${t("login.remember")}</span></label>
              <button type="submit" class="auth-submit">${setup ? t("login.btn_create_admin") : t("login.btn_register")}</button>
              ${setup ? "" : `<p class="auth-hint">${t("login.hint_approval")}</p>`}
            </form>
            <p class="auth-switch">${t("login.have_account")} <button type="button" class="auth-link" data-auth-tab="login">${t("login.tab_login")}</button></p>
          </div>
        </div>
      </section>
    </main>
  `;
}

function renderPending() {
  app.innerHTML = `
    <main class="pending-layout">
      <section class="pending-card">
        <div class="pending-symbol">⌛</div>
        <div class="eyebrow">${t("pending.eyebrow")}</div>
        <h1>${t("pending.title")}</h1>
        <p>${t("pending.text")}</p>
        <div class="pending-user">
          ${avatar(state.me, "small")}
          <strong>${escapeHtml(state.me.displayName)}</strong>
        </div>
        <div>
          <button class="button secondary" data-action="refresh-session">${t("pending.refresh")}</button>
          <button class="button ghost" data-action="logout">${t("pending.logout")}</button>
        </div>
      </section>
    </main>
  `;
}

function showRememberLoginPrompt() {
  openModal(`
    <div id="remember-login-prompt" class="confirm-dialog remember-login-prompt">
      <div class="remember-login-symbol">✓</div>
      <div class="eyebrow">Signed in</div>
      <h2>Angemeldet bleiben?</h2>
      <p class="modal-subtitle">Do you want to stay signed in on this device after closing the browser?</p>
      <div class="remember-login-options">
        <button class="remember-option" type="button" data-action="set-login-persistence" data-remember="true">
          <span>Stay signed in for 30 days</span>
          <small>The session survives a browser or server restart.</small>
        </button>
        <button class="remember-option" type="button" data-action="set-login-persistence" data-remember="false">
          <span>This browser session only</span>
          <small>The session ends when the browser is closed.</small>
        </button>
      </div>
    </div>
  `);
}

function renderShell() {
  const pendingChanges = state.changelogs.filter((entry) => !entry.approved).length;
  const pendingUsers = state.users.filter((user) => !user.approved).length;
  const group = getGroup(state.me.groupId);
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-brand" data-tutorial="brand">
          ${brandLogo()}
          <div><strong>${escapeHtml(brandName())}</strong><span>${escapeHtml(brandTagline() || "Workspace")}</span></div>
        </div>
        <div class="nav-label">${t("nav.workspace")}</div>
        ${navButton("dashboard", "dashboard", t("nav.dashboard"))}
        ${navButton("tasks", "tasks", t("nav.tasks"))}
        ${navButton("ideas", "ideas", t("nav.ideas"), state.ideas.filter((idea) => !idea.taskId).length)}
        ${navButton("bugs", "bugs", t("nav.bugs"), state.bugs.filter((bug) => !bug.taskId).length)}
        ${navButton("definitions", "definitions", t("nav.definitions"))}
        ${navButton("changelog", "changelog", t("nav.changelog"))}
        ${navButton("archive", "archive", t("nav.archive"))}
        ${
          hasPermission("approve_changelog")
            ? `${navButton("review", "review", t("nav.review"), pendingChanges)}`
            : ""
        }
        ${
          hasPermission("manage_users")
            ? `<div class="nav-label">${t("nav.administration")}</div>${navButton("users", "users", t("nav.users"), pendingUsers)}`
            : ""
        }
        ${state.me.isAdmin ? navButton("groups", "groups", t("nav.groups")) : ""}
        ${state.me.isAdmin ? navButton("areas", "areas", t("nav.areas")) : ""}
        ${hasPermission("manage_settings") ? navButton("settings", "settings", t("nav.settings")) : ""}
        <div class="sidebar-footer">
          <button class="user-chip" data-action="logout">
            ${avatar(state.me)}
            <span class="user-chip-copy">
              <strong>${escapeHtml(state.me.displayName)}</strong>
              <span>${escapeHtml(group?.name || "Keine Gruppe")}</span>
            </span>
            <span aria-hidden="true">↪</span>
          </button>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div class="topbar-title">
            <button class="icon-button mobile-menu" data-action="toggle-menu" aria-label="Open menu">${iconSvg("menu")}</button>
            <span>${t("nav.workspace")}</span><span>/</span><strong>${pageTitle()}</strong>
          </div>
          <div class="topbar-actions">
            ${
              state.update && state.update.available && hasPermission("manage_settings")
                ? `<a class="update-pill" href="${escapeHtml(state.update.url)}" target="_blank" rel="noopener" title="${escapeHtml(brandName())} ${escapeHtml(state.update.latest)}">${iconSvg("rocket")}<span>${t("top.update")} ${escapeHtml(state.update.latest)}</span></a>`
                : ""
            }
            <button class="button ghost tutorial-restart" data-action="start-tutorial"><span aria-hidden="true">?</span><span class="tutorial-label">${t("top.tutorial")}</span></button>
          </div>
        </header>
        <div class="content" data-view="${state.page}">${renderPage()}</div>
      </main>
    </div>
  `;
}

function navButton(page, icon, label, count = 0) {
  return `
    <button class="nav-button ${state.page === page ? "active" : ""}" data-page="${page}" data-tutorial="nav-${page}">
      <span class="nav-icon">${iconSvg(icon)}</span>
      <span>${label}</span>
      ${count ? `<span class="nav-badge">${count}</span>` : ""}
    </button>
  `;
}

function renderPage() {
  if (state.page === "dashboard") return renderDashboard();
  if (state.page === "tasks") return renderTasks();
  if (state.page === "ideas") return renderIdeas();
  if (state.page === "bugs") return renderBugs();
  if (state.page === "definitions") return renderProjectDefinitions();
  if (state.page === "changelog") return renderChangelog();
  if (state.page === "archive") return renderArchive();
  if (state.page === "review") return renderReview();
  if (state.page === "users") return renderUsers();
  if (state.page === "groups") return renderGroups();
  if (state.page === "areas") return renderAreas();
  if (state.page === "settings") return renderSettings();
  return "";
}

function renderSettings() {
  const branding = state.branding || {};
  const statuses = [...(state.statuses || [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );
  const tokens = state.apiTokens || [];
  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">${t("set.eyebrow")}</div>
        <h1>${t("set.title")}</h1>
        <p>${t("set.subtitle")}</p>
      </div>
    </div>
    <section class="settings-grid">
      <div class="panel settings-panel">
        <div class="panel-head"><h2>${t("set.branding")}</h2><span>${t("set.custom_branding")}</span></div>
        <form id="branding-form" class="settings-form">
          <label class="field"><span>${t("set.productname")}</span><input name="productName" maxlength="40" value="${escapeHtml(branding.productName || "")}" required /></label>
          <label class="field"><span>${t("set.tagline")}</span><input name="tagline" maxlength="120" value="${escapeHtml(branding.tagline || "")}" /></label>
          <div class="settings-row">
            <label class="field"><span>${t("set.primary")}</span><input name="primaryColor" type="color" value="${escapeHtml(branding.primaryColor || "#6d5dfc")}" /></label>
            <label class="field"><span>${t("set.accent")}</span><input name="accentColor" type="color" value="${escapeHtml(branding.accentColor || "#1fd1c6")}" /></label>
          </div>
          <label class="field"><span>${t("set.logo")}</span><input name="logoUrl" value="${escapeHtml(branding.logoUrl || "")}" placeholder="/assets/branding/..." /></label>
          <label class="field"><span>${t("set.icon")}</span><input name="markUrl" value="${escapeHtml(branding.markUrl || "")}" placeholder="/assets/branding/..." /></label>
          <button type="submit" class="button primary">${t("set.save_branding")}</button>
        </form>
      </div>

      <div class="panel settings-panel">
        <div class="panel-head"><h2>${t("set.statuses")}</h2><span>${t("set.custom_status")}</span></div>
        <div class="status-list">
          ${statuses
            .map(
              (status, index) => `
            <div class="status-row">
              <input type="color" class="status-edit-color" data-status-color="${status.id}" value="${escapeHtml(status.color)}" aria-label="Color" />
              <input class="status-edit-name" data-status-name="${status.id}" value="${escapeHtml(status.name)}" maxlength="40" />
              ${status.isDefault ? `<span class="status-flag">${t("set.flag_default")}</span>` : ""}
              ${status.isDone ? `<span class="status-flag done">${t("set.flag_done")}</span>` : ""}
              <div class="status-actions">
                <button class="icon-button" type="button" data-action="status-move" data-id="${status.id}" data-dir="up" aria-label="Move up" ${index === 0 ? "disabled" : ""}>↑</button>
                <button class="icon-button" type="button" data-action="status-move" data-id="${status.id}" data-dir="down" aria-label="Move down" ${index === statuses.length - 1 ? "disabled" : ""}>↓</button>
                ${
                  status.isDefault
                    ? ""
                    : `<button class="icon-button" type="button" data-action="set-default-status" data-id="${status.id}" title="${t("set.set_default")}">★</button>`
                }
                <button class="icon-button danger-icon" type="button" data-action="delete-status" data-id="${status.id}" ${statuses.length <= 1 ? "disabled" : ""} aria-label="${t("set.delete")}">×</button>
              </div>
            </div>`
            )
            .join("")}
        </div>
        <form id="status-form" class="settings-inline">
          <input name="name" maxlength="40" placeholder="${t("set.new_status")}" required />
          <input name="color" type="color" value="#6d5dfc" aria-label="Status" />
          <label class="inline-check"><input type="checkbox" name="isDone" /> ${t("set.done_label")}</label>
          <button type="submit" class="button secondary">${t("set.add")}</button>
        </form>
      </div>

      <div class="panel settings-panel">
        <div class="panel-head"><h2>${t("set.api_tokens")}</h2><span>${t("set.tokens_active", { n: tokens.length })}</span></div>
        <p class="panel-note">${t("set.token_note")}</p>
        <div class="token-list">
          ${
            tokens.length
              ? tokens
                  .map(
                    (token) => `
            <div class="token-row">
              <div class="token-meta">
                <strong>${escapeHtml(token.name)}</strong>
                <span>${escapeHtml(token.prefix)}… · ${token.scope === "write" ? t("set.scope_write") : t("set.scope_read")}</span>
              </div>
              <button class="button ghost danger-text" type="button" data-action="delete-token" data-id="${token.id}">${t("set.revoke")}</button>
            </div>`
                  )
                  .join("")
              : `<p class="empty-hint">${t("set.no_tokens")}</p>`
          }
        </div>
        <form id="token-form" class="settings-inline">
          <input name="name" maxlength="60" placeholder="${t("set.token_name")}" required />
          <select name="scope" aria-label="Scope">
            <option value="read">${t("set.only_read")}</option>
            <option value="write">${t("set.read_write")}</option>
          </select>
          <button type="submit" class="button secondary">${t("set.create_token")}</button>
        </form>
      </div>
    </section>
  `;
}

function showTokenResult(token, record) {
  openModal(`
    <div class="token-result">
      <div class="eyebrow">API token created</div>
      <h2>${escapeHtml(record.name)}</h2>
      <p class="modal-subtitle">Copy this token now. For security reasons it is shown only once.</p>
      <code class="token-secret">${escapeHtml(token)}</code>
      <div class="modal-actions">
        <button class="button primary" data-close-modal>Verstanden</button>
      </div>
    </div>
  `);
}

function renderDashboard() {
  const openTasks = state.tasks.filter((task) => !isDoneStatus(task.status)).length;
  const testing = state.tasks.filter((task) => task.status === "testing").length;
  const pending = state.changelogs.filter((entry) => !entry.approved).length;
  const completed = state.tasks.filter((task) => isDoneStatus(task.status)).length;
  const completion = state.tasks.length ? Math.round((completed / state.tasks.length) * 100) : 0;
  const recentChanges = [...state.changelogs]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);
  const deadlines = sortTasksForCurrentUser(
    state.tasks.filter((task) => !isDoneStatus(task.status))
  ).slice(0, 5);

  return `
    <div class="page-head" data-tutorial="page-dashboard">
      <div>
        <div class="eyebrow">Hello, ${escapeHtml(state.me.displayName)}</div>
        <h1>Project overview</h1>
        <p>All ongoing work, upcoming deadlines and changelog activity at a glance.</p>
      </div>
      <div class="page-actions">
        ${hasPermission("submit_changelog") ? `<button class="button secondary" data-action="new-change">Submit changelog</button>` : ""}
        ${hasPermission("create_task") ? `<button class="button primary" data-action="new-task">${iconSvg("plus")}<span>New task</span></button>` : ""}
      </div>
    </div>
    <section class="metrics">
      ${metricCard("Open tasks", openTasks, `${state.tasks.length} total`, "#8b5cf6", "tasks")}
      ${metricCard("In testing", testing, "ready for review", "#38bdf8", "testing")}
      ${metricCard("Approvals", pending, "Changelog pending", "#f59e0b", "review")}
      ${metricCard("Progress", `${completion}%`, `${completed} completed`, "#22c55e", "progress")}
    </section>
    <section class="dashboard-grid">
      <div class="panel">
        <div class="panel-head"><h2>Recent changelog activity</h2><span>${recentChanges.length} entries</span></div>
        <div class="activity-list">
          ${
            recentChanges.length
              ? recentChanges
                  .map(
                    (entry) => `
                  <div class="activity-row">
                    <span class="activity-dot" style="background:${entry.approved ? "#22c55e" : "#f59e0b"}"></span>
                    <div class="activity-copy">
                      <strong>${escapeHtml(entry.scriptName)} · ${escapeHtml(entry.description)}</strong>
                      <span>${typeLabels[entry.type]} von ${escapeHtml(entry.authorName)} · ${timeAgo(entry.createdAt)}</span>
                    </div>
                    <span class="${entry.approved ? "approved-check" : "pending-x"}">${entry.approved ? "✓" : "X"}</span>
                  </div>`
                  )
                  .join("")
              : emptyInline("No activity yet")
          }
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Upcoming deadlines</h2><span>Due dates</span></div>
        <div class="deadline-list">
          ${
            deadlines.length
              ? deadlines
                  .map(
                    (task) => `
                  <div class="deadline-row">
                    <div class="deadline-copy">
                      <strong>${escapeHtml(task.title)}</strong>
                      <span>${statusConfig[task.status].label} · ${projectTypeLabel(task.projectType)}</span>
                    </div>
                    <div class="deadline-date"><b>${formatDate(task.dueDate)}</b>${t("prio." + task.priority)}</div>
                  </div>`
                  )
                  .join("")
              : emptyInline("No upcoming deadlines")
          }
        </div>
      </div>
    </section>
  `;
}

function metricCard(label, value, note, color, icon) {
  return `
    <article class="metric-card" style="--metric-color:${color}">
      <div class="metric-top"><span>${label}</span><span class="metric-icon">${iconSvg(icon)}</span></div>
      <div class="metric-value">${value}</div>
      <div class="metric-note">${note}</div>
    </article>
  `;
}

function renderTasks() {
  const filtered = state.tasks.filter((task) => {
    const search = state.taskSearch.toLowerCase();
    const matchesSearch =
      !search ||
      task.title.toLowerCase().includes(search) ||
      String(task.description || "").toLowerCase().includes(search);
    const matchesPriority = state.taskPriority === "alle" || task.priority === state.taskPriority;
    const matchesArea =
      state.taskArea === "alle" ||
      (state.taskArea === "allgemein" ? !task.areaId : task.areaId === state.taskArea);
    return matchesSearch && matchesPriority && matchesArea && taskMatchesScope(task);
  });
  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">${t("task.eyebrow")}</div>
        <h1>${t("task.title")}</h1>
        <p>${t("task.desc")}${hasPermission("manage_tasks") ? t("task.desc_manage") : ""}</p>
      </div>
      ${hasPermission("create_task") ? `<button class="button primary" data-action="new-task">${iconSvg("plus")}<span>${t("task.new")}</span></button>` : ""}
    </div>
    <div class="toolbar">
      <label class="search"><input data-task-search value="${escapeHtml(state.taskSearch)}" placeholder="${t("task.search")}" /></label>
      <select class="filter-select task-scope-filter" data-task-scope>
        <option value="own" ${state.taskScope === "own" ? "selected" : ""}>${t("task.scope_own")}</option>
        <option value="areas" ${state.taskScope === "areas" ? "selected" : ""} ${getUserAreaIds().length ? "" : "disabled"}>${t("task.scope_areas")}${getUserAreaIds().length ? "" : t("task.scope_areas_none")}</option>
        <option value="all" ${state.taskScope === "all" ? "selected" : ""}>${t("task.scope_all")}</option>
      </select>
      <select class="filter-select" data-task-area-filter>
        <option value="alle" ${state.taskArea === "alle" ? "selected" : ""}>${t("task.area_all")}</option>
        <option value="allgemein" ${state.taskArea === "allgemein" ? "selected" : ""}>${t("task.area_none")}</option>
        ${state.areas
          .map(
            (area) =>
              `<option value="${area.id}" ${state.taskArea === area.id ? "selected" : ""}>${escapeHtml(area.name)}</option>`
          )
          .join("")}
      </select>
      <select class="filter-select" data-task-priority>
        ${["alle", "kritisch", "hoch", "mittel", "niedrig"].map((value) => `<option value="${value}" ${state.taskPriority === value ? "selected" : ""}>${value === "alle" ? t("task.prio_all") : t("prio." + value)}</option>`).join("")}
      </select>
    </div>
    <section class="board" data-tutorial="task-board">
      ${Object.entries(statusConfig)
        .map(([status, config]) => {
          const tasks = sortTasksForCurrentUser(
            filtered.filter((task) => task.status === status)
          );
          return `
            <div class="board-column" data-task-status="${status}">
              <div class="column-head">
                <span class="column-title"><i class="column-dot" style="background:${config.color}"></i>${config.label}</span>
                <span class="column-count">${tasks.length}</span>
              </div>
              ${tasks.map(renderTaskCard).join("")}
            </div>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderTaskCard(task) {
  const assignee = getUser(task.assigneeId);
  const area = getArea(task.areaId);
  const isOwn = isTaskAssignedToCurrentUser(task);
  const needsPerson = !task.assigneeId;
  const mayDrag = canMoveTask(task);
  return `
    <article class="task-card ${isOwn ? "task-card-own" : ""} ${needsPerson ? "task-card-open" : ""} ${mayDrag ? "task-card-draggable" : ""}" data-task-id="${task.id}" data-task-status="${task.status}" draggable="${mayDrag ? "true" : "false"}">
      ${
        mayDrag
          ? `<button class="task-drag-handle" type="button" draggable="true" data-drag-handle aria-label="Move task" title="Move task">${iconSvg("drag")}</button>`
          : ""
      }
      <div class="tc-head">
        <span class="tc-dot priority-${task.priority}" title="${t("prio." + task.priority)}"></span>
        ${
          isOwn
            ? `<span class="tc-tag tc-mine">${t("task.yours")}</span>`
            : needsPerson
              ? `<span class="tc-tag tc-open">${t("task.open")}</span>`
              : ""
        }
      </div>
      <h3>${escapeHtml(task.title)}</h3>
      <div class="tc-foot">
        <span class="tc-area" style="--ac:${area?.color || "#74747f"}">${escapeHtml(area?.name || t("task.general"))}</span>
        ${assignee ? avatar(assignee, "tiny") : ""}
      </div>
    </article>
  `;
}

function getLinkedTask(record) {
  return record.taskId ? state.tasks.find((task) => task.id === record.taskId) : null;
}

function renderLinkedTaskStatus(record) {
  if (!record.taskId) {
    return `<span class="source-state source-state-open"><i></i>No tasks yet</span>`;
  }
  const task = getLinkedTask(record);
  if (!task) {
    return `<span class="source-state source-state-missing"><i></i>Linked task no longer exists</span>`;
  }
  const assignee = getUser(task.assigneeId);
  return `
    <button class="source-task-link" type="button" data-action="view-linked-task" data-id="${task.id}">
      <span class="source-state" style="--source-color:${statusConfig[task.status].color}">
        <i></i>${statusConfig[task.status].label}
      </span>
      <span>${assignee ? `durch ${escapeHtml(assignee.displayName)}` : "not yet assigned"}</span>
    </button>
  `;
}

function renderIdeas() {
  const ideas = [...state.ideas].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return `
    <div class="page-head" data-tutorial="page-ideas">
      <div>
        <div class="eyebrow">Suggestions from the team</div>
        <h1>Ideas</h1>
        <p>Every approved user can submit an idea. Once it becomes a task you see its status and owner right here.</p>
      </div>
      <button class="button primary" data-action="new-idea">${iconSvg("plus")}<span>Submit idea</span></button>
    </div>
    ${
      ideas.length
        ? `<section class="source-list">${ideas.map(renderIdeaCard).join("")}</section>`
        : `<div class="empty"><div><strong>No ideas yet</strong>Submit the first suggestion for the team.</div></div>`
    }
  `;
}

function renderIdeaCard(idea) {
  return `
    <article class="source-card">
      <div class="source-card-top">
        <span class="source-kind">${iconSvg("ideas")} Idee</span>
        <span>${formatDateTime(idea.createdAt)}</span>
      </div>
      <p class="source-copy">${escapeHtml(idea.text)}</p>
      <div class="source-card-foot">
        <div class="source-author">
          ${avatar(getUser(idea.authorId) || { displayName: idea.authorName }, "small")}
          <span>Submitted by ${escapeHtml(idea.authorName)}</span>
        </div>
        <div class="source-actions">
          ${renderLinkedTaskStatus(idea)}
          ${
            !idea.taskId && hasPermission("create_task")
              ? `<button class="button secondary" data-action="convert-idea" data-id="${idea.id}">Create as task</button>`
              : ""
          }
        </div>
      </div>
    </article>
  `;
}

function renderBugs() {
  const bugs = [...state.bugs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return `
    <div class="page-head" data-tutorial="page-bugs">
      <div>
        <div class="eyebrow">Fehler nachvollziehbar melden</div>
        <h1>Bug reports</h1>
        <p>Describe the affected area and the misbehavior. Images or videos are optional and may be up to 250 MB.</p>
      </div>
      <button class="button primary" data-action="new-bug">${iconSvg("plus")}<span>Report bug</span></button>
    </div>
    ${
      bugs.length
        ? `<section class="source-list">${bugs.map(renderBugCard).join("")}</section>`
        : `<div class="empty"><div><strong>No bugs reported yet</strong>New reports appear here together.</div></div>`
    }
  `;
}

function renderBugCard(bug) {
  const media = bug.media;
  return `
    <article class="source-card bug-card">
      <div class="source-card-top">
        <div class="card-flags">
          <span class="source-kind">${iconSvg("bugs")} Bug</span>
          <span class="pill priority-${bug.importance}">${capitalize(bug.importance)}</span>
        </div>
        <span>${formatDateTime(bug.createdAt)}</span>
      </div>
      <h2>${escapeHtml(bug.subject)}</h2>
      <p class="source-copy">${escapeHtml(bug.description)}</p>
      ${
        media
          ? `<div class="report-media">
              ${
                media.kind === "video"
                  ? `<video src="${escapeHtml(media.url)}" controls preload="metadata"></video>`
                  : `<a href="${escapeHtml(media.url)}" target="_blank" rel="noopener"><img src="${escapeHtml(media.url)}" alt="${escapeHtml(media.originalName || "Bug-Anhang")}" loading="lazy" /></a>`
              }
              <div>
                <span>${escapeHtml(media.originalName || "Medienupload")}</span>
                <small>${formatFileSize(media.size)}</small>
              </div>
            </div>`
          : ""
      }
      <div class="source-card-foot">
        <div class="source-author">
          ${avatar(getUser(bug.authorId) || { displayName: bug.authorName }, "small")}
          <span>Reported by ${escapeHtml(bug.authorName)}</span>
        </div>
        <div class="source-actions">
          ${renderLinkedTaskStatus(bug)}
          ${
            !bug.taskId && hasPermission("create_task")
              ? `<button class="button secondary" data-action="convert-bug" data-id="${bug.id}">Create as task</button>`
              : ""
          }
        </div>
      </div>
    </article>
  `;
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function renderProjectDefinitions() {
  return `
    <div class="page-head" data-tutorial="page-definitions">
      <div>
        <div class="eyebrow">Einheitliche Einordnung</div>
        <h1>Projektdefinitionen</h1>
        <p>Project size depends on difficulty, technical scope, risk of bugs and the required testing effort.</p>
      </div>
    </div>
    <section class="definition-grid">
      <article class="definition-card definition-small">
        <div class="definition-number">01</div>
        <span class="definition-label">Small project</span>
        <h2>Normal fixes and adjustments</h2>
        <p>A small project is a clearly bounded change that can be implemented and tested without major technical planning.</p>
        <ul>
          <li>Normal, not particularly difficult bug fixes</li>
          <li>Config changes and minor value adjustments</li>
          <li>Small additions to existing features</li>
          <li>Few dependencies and manageable testing effort</li>
        </ul>
        <div class="definition-example"><span>Examples</span>Change a config, adjust a vehicle value, fix a normal item bug or add some text.</div>
      </article>
      <article class="definition-card definition-medium">
        <div class="definition-number">02</div>
        <span class="definition-label">Medium project</span>
        <h2>Small custom builds and serious bugs</h2>
        <p>A medium project needs a clear roadmap and several tests but stays technically well-defined.</p>
        <ul>
          <li>Smaller custom scripts or standalone modules</li>
          <li>Harder bugs with several possible causes</li>
          <li>Changes across several related features</li>
          <li>Several implementation and testing steps required</li>
        </ul>
        <div class="definition-example"><span>Examples</span>A small custom management script, a more complex vehicle bug or an extension of an existing system.</div>
      </article>
      <article class="definition-card definition-large">
        <div class="definition-number">03</div>
        <span class="definition-label">Large project</span>
        <h2>Very extensive systems and bugs</h2>
        <p>A large project involves a major custom build or a particularly severe bug with far-reaching technical impact.</p>
        <ul>
          <li>Huge custom scripts or complete new systems</li>
          <li>Very serious and deep bugs</li>
          <li>Many dependencies on other scripts or data</li>
          <li>High planning, coordination and testing effort</li>
        </ul>
        <div class="definition-example"><span>Examples</span>A full job system, a large inventory system, a comprehensive data migration or a critical cross-system bug.</div>
      </article>
    </section>
    <section class="definition-rule">
      <span class="eyebrow">Entscheidungsregel</span>
      <h2>Classify by the actual effort</h2>
      <p>Normal fixes and configs are small. Small custom scripts and harder bugs are medium. Very large custom builds or particularly severe cross-system bugs are large projects.</p>
    </section>
  `;
}

function renderChangelog() {
  const sorted = [...state.changelogs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const approved = sorted.filter((entry) => entry.approved).length;
  return `
    <div class="page-head" data-tutorial="page-changelog">
      <div>
        <div class="eyebrow">Versionsverlauf</div>
        <h1>Changelog</h1>
        <p>Unapproved entries are visible to everyone and marked with a red X.</p>
      </div>
      <div class="page-actions">
        ${hasPermission("push_changelog") ? `<button class="button secondary" data-action="push-changelog">Webhook push</button>` : ""}
        ${hasPermission("submit_changelog") ? `<button class="button primary" data-action="new-change">${iconSvg("plus")}<span>New entry</span></button>` : ""}
      </div>
    </div>
    <section class="changelog-layout">
      <div class="changelog-list">
        ${
          sorted.length
            ? sorted.map(renderChangeRow).join("")
            : `<div class="empty"><div><strong>Current changelog is empty</strong>After a push you can find the published entries under „Past changelogs“.</div></div>`
        }
      </div>
      <aside class="changelog-aside">
        <div class="info-card">
          <h3>Approval status</h3>
          <p>${approved} of ${sorted.length} entries reviewed by the lead.</p>
          <div class="legend">
            <div class="legend-row"><span class="approved-check">✓</span> Freigegeben</div>
            <div class="legend-row"><span class="pending-x">X</span> Review pending</div>
          </div>
        </div>
        <div class="info-card">
          <h3>Last webhook push</h3>
          <p>${
            state.settings.lastChangelogPush
              ? `${formatDate(state.settings.lastChangelogPush.publishedAt, { year: "numeric" })} · ${state.settings.lastChangelogPush.entryCount} entries`
              : "No changelog has been published yet."
          }</p>
        </div>
      </aside>
    </section>
  `;
}

function renderArchive() {
  const archives = [...state.archivedChangelogs].sort(
    (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
  );
  const entryCount = archives.reduce((sum, archive) => sum + archive.entries.length, 0);
  return `
    <div class="page-head" data-tutorial="page-archive">
      <div>
        <div class="eyebrow">Releases</div>
        <h1>Alte Changelogs</h1>
        <p>Every changelog already published via Discord webhook stays here permanently.</p>
      </div>
      <span class="pill">${archives.length} Pushes · ${entryCount} entries</span>
    </div>
    ${
      archives.length
        ? `<section class="archive-list">${archives.map(renderArchiveRelease).join("")}</section>`
        : `<div class="empty"><div><strong>No release yet</strong>After the first changelog push the release appears here.</div></div>`
    }
  `;
}

function renderArchiveRelease(archive) {
  const counts = Object.fromEntries(
    Object.keys(typeLabels).map((type) => [
      type,
      archive.entries.filter((entry) => entry.type === type).length
    ])
  );
  return `
    <article class="archive-release">
      <header class="archive-head">
        <div>
          <span class="archive-kicker">Webhook push</span>
          <h2>${escapeHtml(archive.title || `Changelog vom ${formatDate(archive.publishedAt, { year: "numeric" })}`)}</h2>
          <div class="archive-meta">
            <span>Published ${formatDateTime(archive.publishedAt)}</span>
            <span>Valid from ${formatDateTime(archive.effectiveAt)}</span>
            <span>Von ${escapeHtml(archive.publishedByName || "Entwicklungsleitung")}</span>
          </div>
        </div>
        <div class="archive-total">${archive.entries.length}<span>entries</span></div>
      </header>
      <div class="archive-summary">
        ${Object.entries(typeLabels)
          .map(
            ([type, label]) =>
              `<span class="${type}"><b>${counts[type]}</b>${label}</span>`
          )
          .join("")}
      </div>
      <div class="archive-groups">
        ${Object.entries(typeLabels)
          .map(([type, label]) => {
            const entries = archive.entries.filter((entry) => entry.type === type);
            return `
              <section class="archive-group">
                <h3 class="change-type ${type}">${label}</h3>
                <div>
                  ${
                    entries.length
                      ? entries
                          .map(
                            (entry) => `
                              <div class="archive-entry">
                                <strong>${escapeHtml(entry.scriptName)}</strong>
                                <span>${escapeHtml(entry.description)}</span>
                              </div>`
                          )
                          .join("")
                      : `<div class="archive-entry empty-entry"><span>nichts</span></div>`
                  }
                </div>
              </section>
            `;
          })
          .join("")}
      </div>
    </article>
  `;
}

function renderChangeRow(entry) {
  const mayDelete = canDeleteChange(entry);
  const mayEdit = hasPermission("approve_changelog") && !entry.publishedAt;
  return `
    <article class="change-row">
      <span class="change-type ${entry.type}">${typeLabels[entry.type]}</span>
      <div class="change-copy">
        <strong>${escapeHtml(entry.scriptName)}</strong>
        <p>${escapeHtml(entry.description)}</p>
        <div class="change-meta">
          <span>${escapeHtml(entry.authorName)}</span>
          <span>${formatDate(entry.createdAt, { year: "numeric" })}</span>
          ${entry.publishedAt ? "<span>Published</span>" : ""}
        </div>
      </div>
      <div class="change-controls">
        <span class="${entry.approved ? "approved-check" : "pending-x"}" title="${entry.approved ? "Freigegeben" : "Not yet approved"}">${entry.approved ? "✓" : "X"}</span>
        ${
          mayEdit || mayDelete
            ? `<div class="change-actions">
                ${mayEdit ? `<button class="icon-button" data-action="edit-change" data-id="${entry.id}" aria-label="Eintrag bearbeiten">✎</button>` : ""}
                ${mayDelete ? `<button class="icon-button danger-icon" data-action="delete-change" data-id="${entry.id}" aria-label="Delete entry">×</button>` : ""}
              </div>`
            : ""
        }
      </div>
    </article>
  `;
}

function renderReview() {
  const pending = state.changelogs.filter((entry) => !entry.approved);
  return `
    <div class="page-head" data-tutorial="page-review">
      <div>
        <div class="eyebrow">Entwicklungsleitung</div>
        <h1>Changelog approvals</h1>
        <p>Review entries, refine the wording and approve them for the next webhook push.</p>
      </div>
      <span class="pill">${pending.length} pending</span>
    </div>
    ${
      pending.length
        ? `<section class="review-grid">${pending
            .map(
              (entry) => `
              <article class="review-card">
                <span class="change-type ${entry.type}">${typeLabels[entry.type]}</span>
                <h3>${escapeHtml(entry.scriptName)}</h3>
                <p>${escapeHtml(entry.description)}</p>
                <div class="review-author">
                  ${avatar(getUser(entry.authorId), "tiny")}
                  <span>${escapeHtml(entry.authorName)} · ${timeAgo(entry.createdAt)}</span>
                </div>
                <div class="review-actions">
                  <button class="button secondary" data-action="edit-change" data-id="${entry.id}">Bearbeiten</button>
                  <button class="button danger" data-action="delete-change" data-id="${entry.id}">Delete</button>
                  <button class="button primary" data-action="approve-change" data-id="${entry.id}">Freigeben</button>
                </div>
              </article>`
            )
            .join("")}</section>`
        : `<div class="empty"><div><strong>All reviewed</strong>No changelog entries are awaiting approval right now.</div></div>`
    }
  `;
}

function renderUsers() {
  const sorted = [...state.users].sort((a, b) => Number(a.approved) - Number(b.approved));
  return `
    <div class="page-head" data-tutorial="page-users">
      <div>
        <div class="eyebrow">Zugriffsverwaltung</div>
        <h1>Users & permissions</h1>
        <p>Approve new users and assign roles and multiple areas.</p>
      </div>
    </div>
    <section class="table-shell">
      ${sorted
        .map((user) => {
          const group = getGroup(user.groupId);
          const userAreas = getUserAreaIds(user).map(getArea).filter(Boolean);
          return `
            <div class="user-row">
              <div class="user-identity">
                ${avatar(user)}
                <div><strong>${escapeHtml(user.displayName)}</strong><span>@${escapeHtml(user.username)}</span></div>
              </div>
              ${
                group
                  ? `<span class="group-badge" style="--group-color:${group.color}"><i></i>${escapeHtml(group.name)}</span>`
                  : `<span class="group-badge" style="--group-color:#f59e0b"><i></i>Unassigned</span>`
              }
              <div class="user-area-list">
                ${
                  userAreas.length
                    ? userAreas
                        .map(
                          (area) =>
                            `<span class="area-badge" style="--area-color:${area.color}"><i></i>${escapeHtml(area.name)}</span>`
                        )
                        .join("")
                    : `<span class="area-empty">No area · sees all by default</span>`
                }
              </div>
              <span class="status-text ${user.approved ? "" : "pending"}">${user.approved ? "Freigeschaltet" : "Wartet auf Freigabe"}</span>
              <div class="user-actions">
                <button class="button ghost" data-action="manage-user" data-id="${user.id}">${user.approved ? "Edit access" : "Approve"}</button>
              </div>
            </div>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderGroups() {
  return `
    <div class="page-head" data-tutorial="page-groups">
      <div>
        <div class="eyebrow">Administration</div>
        <h1>Roles & permissions</h1>
        <p>Create roles freely and equip them with the available permissions.</p>
      </div>
      <button class="button primary" data-action="new-group">${iconSvg("plus")}<span>New role</span></button>
    </div>
    <section class="groups-grid">
      ${[...state.groups]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((group, groupIndex, groupArr) => {
          const memberCount = state.users.filter((user) => user.groupId === group.id).length;
          return `
            <article class="group-card" style="--group-color:${group.color}">
              <header class="group-card-head">
                <div class="group-card-title">
                  <span class="group-color-dot"></span>
                  <div><h2>${escapeHtml(group.name)}</h2><span>${memberCount} users</span></div>
                </div>
                <div class="group-head-actions">
                  <button class="icon-button" type="button" data-action="group-move" data-id="${group.id}" data-dir="up" aria-label="Move up" ${groupIndex === 0 ? "disabled" : ""}>↑</button>
                  <button class="icon-button" type="button" data-action="group-move" data-id="${group.id}" data-dir="down" aria-label="Move down" ${groupIndex === groupArr.length - 1 ? "disabled" : ""}>↓</button>
                  <button class="icon-button" data-action="edit-group" data-id="${group.id}" aria-label="Edit role">✎</button>
                </div>
              </header>
              <div class="group-permissions">
                ${
                  group.permissions.length
                    ? group.permissions
                        .map(
                          (permission) =>
                            `<span>${escapeHtml(permissionLabels[permission] || permission)}</span>`
                        )
                        .join("")
                    : `<span class="no-permissions">No permissions</span>`
                }
              </div>
              <footer class="group-card-foot">
                <span>${group.permissions.length} ${group.permissions.length === 1 ? "permission" : "permissions"}</span>
                <button class="button ghost danger-text" data-action="delete-group" data-id="${group.id}" ${memberCount ? "disabled" : ""}>Delete</button>
              </footer>
            </article>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderAreas() {
  return `
    <div class="page-head" data-tutorial="page-areas">
      <div>
        <div class="eyebrow">Aufgabenzuordnung</div>
        <h1>Areas</h1>
        <p>Areas structure tasks and can be assigned to each user multiple times.</p>
      </div>
      <button class="button primary" data-action="new-area">${iconSvg("plus")}<span>New area</span></button>
    </div>
    ${
      state.areas.length
        ? `<section class="groups-grid">
            ${state.areas
              .map((area) => {
                const memberCount = state.users.filter((user) =>
                  getUserAreaIds(user).includes(area.id)
                ).length;
                const taskCount = state.tasks.filter((task) => task.areaId === area.id).length;
                return `
                  <article class="group-card area-card" style="--group-color:${area.color}">
                    <header class="group-card-head">
                      <div class="group-card-title">
                        <span class="group-color-dot"></span>
                        <div><h2>${escapeHtml(area.name)}</h2><span>${memberCount} users · ${taskCount} Aufgaben</span></div>
                      </div>
                      <button class="icon-button" data-action="edit-area" data-id="${area.id}" aria-label="Edit area">✎</button>
                    </header>
                    <div class="area-card-copy">
                      Open tasks of this area stay visible to everyone. Only assigned members can claim them.
                    </div>
                    <footer class="group-card-foot">
                      <span>${memberCount ? "members assigned" : "No members yet"}</span>
                      <button class="button ghost danger-text" data-action="delete-area" data-id="${area.id}" ${memberCount || taskCount ? "disabled" : ""}>Delete</button>
                    </footer>
                  </article>
                `;
              })
              .join("")}
          </section>`
        : `<div class="empty"><div><strong>No areas yet</strong>Create the first area and then assign it to users and tasks.</div></div>`
    }
  `;
}

function emptyInline(text) {
  return `<div class="activity-row"><div class="activity-copy"><span>${text}</span></div></div>`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDateTime(value) {
  if (!value) return "Unbekannt";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      reject(new Error(`${file.name}: Erlaubt sind JPEG, PNG, WebP und GIF.`));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error(`${file.name}: Ein Bild darf maximal 5 MB gross sein.`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`${file.name} konnte nicht gelesen werden.`));
    reader.readAsDataURL(file);
  });
}

async function uploadTaskImages(taskId, files) {
  for (const file of files) {
    const data = await readImageFile(file);
    await api(`/api/tasks/${taskId}/images`, {
      method: "POST",
      body: JSON.stringify({
        name: file.name,
        mimeType: file.type,
        data
      })
    });
  }
}

function renderExistingTaskImages(task) {
  const images = Array.isArray(task?.images) ? task.images : [];
  if (!images.length) return "";
  return `
    <div class="task-image-existing">
      ${images
        .map(
          (image) => `
            <label class="task-image-edit-item">
              <img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.originalName || "Aufgabenbild")}" />
              <span title="${escapeHtml(image.originalName || "Bild")}">${escapeHtml(image.originalName || "Bild")}</span>
              <span class="task-image-remove"><input type="checkbox" name="removeImageIds" value="${image.id}" /> Entfernen</span>
            </label>
          `
        )
        .join("")}
    </div>
  `;
}

function renderTaskAssigneeOptions(areaId, selectedId = "") {
  return state.users
    .filter(
      (user) =>
        user.approved && (!areaId || getUserAreaIds(user).includes(areaId))
    )
    .map(
      (user) =>
        `<option value="${user.id}" ${selectedId === user.id ? "selected" : ""}>${escapeHtml(user.displayName)}</option>`
    )
    .join("");
}

function showIdeaForm() {
  openModal(`
    <form id="idea-form">
      <h2>Submit idea</h2>
      <p class="modal-subtitle">Describe your suggestion so the team can understand and assess it right away.</p>
      <div class="field">
        <label for="idea-text">Your idea</label>
        <textarea id="idea-text" name="text" maxlength="2000" required placeholder="What would you like to suggest?"></textarea>
        <span class="field-hint">Once submitted, the idea is visible to every approved user.</span>
      </div>
      <div class="modal-actions">
        <button type="button" class="button secondary" data-close-modal>Cancel</button>
        <button type="submit" class="button primary">Submit idea</button>
      </div>
    </form>
  `);
}

function showBugForm() {
  openModal(`
    <form id="bug-form">
      <h2>Report bug</h2>
      <p class="modal-subtitle">The more precise the description, the faster the bug can be reproduced and fixed.</p>
      <div class="form-grid">
        <div class="field full">
          <label for="bug-subject">Skript / Fahrzeug / System</label>
          <input id="bug-subject" name="subject" maxlength="120" required placeholder="e.g. ox_inventory, Sultan RS or a garage system" />
        </div>
        <div class="field full">
          <label for="bug-description">Was ist falsch?</label>
          <textarea id="bug-description" name="description" maxlength="3000" required placeholder="Describe the expected behavior, the bug and ideally the steps to reproduce it."></textarea>
        </div>
        <div class="field">
          <label for="bug-importance">Wichtigkeit</label>
          <select id="bug-importance" name="importance">
            <option value="niedrig">Niedrig</option>
            <option value="mittel" selected>Medium</option>
            <option value="hoch">Hoch</option>
            <option value="kritisch">Kritisch</option>
          </select>
        </div>
        <div class="field full report-upload-field">
          <label for="bug-media">Image or video <span class="optional-label">optional</span></label>
          <label class="report-upload-picker" for="bug-media">
            <span class="report-upload-icon">${iconSvg("plus")}</span>
            <span><b>Choose file</b><small>JPEG, PNG, WebP, GIF, MP4, WebM or MOV · max 250 MB</small></span>
          </label>
          <input id="bug-media" class="task-image-input" name="media" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.mov" />
          <div class="report-file-info" data-report-file-info></div>
          <div class="report-upload-progress" data-report-upload-progress hidden>
            <div><span data-report-upload-label>Preparing upload...</span><b data-report-upload-percent>0 %</b></div>
            <progress max="100" value="0"></progress>
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="button secondary" data-close-modal>Cancel</button>
        <button type="submit" class="button primary">Report bug</button>
      </div>
    </form>
  `);
}

function getReportMimeType(file) {
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/quicktime"
  ];
  if (allowed.includes(file.type)) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  return {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime"
  }[extension] || "";
}

function validateReportMedia(file) {
  const mimeType = getReportMimeType(file);
  if (!mimeType) throw new Error("Erlaubt sind JPEG, PNG, WebP, GIF, MP4, WebM und MOV.");
  if (file.size > 250 * 1024 * 1024) {
    throw new Error("The media upload may be at most 250 MB.");
  }
  if (!file.size) throw new Error("The selected file is empty.");
  return mimeType;
}

function uploadBugMedia(bugId, file, onProgress) {
  const mimeType = validateReportMedia(file);
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `/api/bugs/${encodeURIComponent(bugId)}/media`);
    request.responseType = "json";
    request.setRequestHeader("Content-Type", mimeType);
    request.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        resolve(request.response);
        return;
      }
      reject(new Error(request.response?.error || "Der Medienupload ist fehlgeschlagen."));
    });
    request.addEventListener("error", () => reject(new Error("Der Medienupload ist fehlgeschlagen.")));
    request.send(file);
  });
}

function showSourceTaskForm(type, record) {
  const isIdea = type === "idea";
  const taskAreaId = getUserAreaIds().length ? getUserAreaIds()[0] : "";
  const defaultTitle = isIdea
    ? record.text.split(/\r?\n/)[0].slice(0, 100)
    : record.subject.slice(0, 100);
  const defaultDescription = isIdea
    ? record.text.slice(0, 1000)
    : `Betroffen: ${record.subject}\n\nFehlerbeschreibung:\n${record.description}`.slice(0, 1000);
  const defaultRoadmap = isIdea
    ? "1. Review idea and requirements\n2. Plan the implementation\n3. Build it\n4. Test the result"
    : "1. Fehler reproduzieren\n2. Ursache analysieren\n3. Fehler beheben\n4. Fix testen";
  const defaultPriority = isIdea ? "mittel" : record.importance;

  openModal(`
    <form id="source-task-form">
      <h2>${isIdea ? "Idee" : "Bug"} as a task</h2>
      <p class="modal-subtitle">All task data can be adjusted before creation. The later status and assignee are shown automatically in the original entry.</p>
      <div class="source-preview">
        <span>${isIdea ? "Original idea" : "Original bug report"}</span>
        <p>${escapeHtml(isIdea ? record.text : `${record.subject}: ${record.description}`)}</p>
      </div>
      <div class="form-grid">
        <div class="field full">
          <label for="task-title">Titel</label>
          <input id="task-title" name="title" maxlength="100" required value="${escapeHtml(defaultTitle)}" />
        </div>
        <div class="field full">
          <label for="task-description">Beschreibung <span class="optional-label">optional</span></label>
          <textarea id="task-description" name="description" maxlength="1000">${escapeHtml(defaultDescription)}</textarea>
        </div>
        <div class="field">
          <label for="task-type">Project size</label>
          <select id="task-type" name="projectType">
            <option value="kleinprojekt">Small project</option>
            <option value="mittelprojekt">Medium project</option>
            <option value="grossprojekt">Large project</option>
          </select>
        </div>
        <div class="field">
          <label for="task-priority">Priority</label>
          <select id="task-priority" name="priority">
            ${["niedrig", "mittel", "hoch", "kritisch"].map((value) => `<option value="${value}" ${defaultPriority === value ? "selected" : ""}>${capitalize(value)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="task-status">Status</label>
          <select id="task-status" name="status">
            ${Object.entries(statusConfig).map(([value, config]) => `<option value="${value}" ${value === defaultStatusKey ? "selected" : ""}>${config.label}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="task-area">Area</label>
          <select id="task-area" name="areaId">
            <option value="">General · no area</option>
            ${state.areas.map((area) => `<option value="${area.id}" ${taskAreaId === area.id ? "selected" : ""}>${escapeHtml(area.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field full">
          <label for="task-assignee">Zuweisung</label>
          <select id="task-assignee" name="assigneeId">
            <option value="">Open · ${taskAreaId ? "area can claim" : "anyone can claim"}</option>
            ${renderTaskAssigneeOptions(taskAreaId)}
          </select>
        </div>
        <div class="field full">
          <label for="task-roadmap">Fahrplan / Umsetzung <span class="optional-label">optional</span></label>
          <textarea id="task-roadmap" name="roadmap" maxlength="3000">${escapeHtml(defaultRoadmap)}</textarea>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="button secondary" data-close-modal>Cancel</button>
        <button type="submit" class="button primary">Create task</button>
      </div>
      <input type="hidden" name="sourceType" value="${type}" />
      <input type="hidden" name="sourceId" value="${record.id}" />
    </form>
  `);
}

function autoDetectTask() {
  const typeEl = document.querySelector("#task-type");
  const prioEl = document.querySelector("#task-priority");
  const titleEl = document.querySelector("#task-title");
  if (!typeEl || !prioEl || !titleEl) return;
  const desc = document.querySelector("#task-description")?.value || "";
  const roadmap = document.querySelector("#task-roadmap")?.value || "";
  const text = `${titleEl.value} ${desc} ${roadmap}`.toLowerCase();
  if (!text.trim()) return;

  let priority = "mittel";
  if (/(kritisch|critical|crash|outage|exploit|security|sicherheit|datenverlust|data loss|produktionsausfall|dringend|urgent|blocker|offline)/.test(text)) {
    priority = "kritisch";
  } else if (/(wichtig|important|broken|kaputt|defekt|\bbug\b|fehler|asap|\bhigh\b)/.test(text)) {
    priority = "hoch";
  } else if (/(typo|tippfehler|wording|cosmetic|kosmetisch|minor|kleinigkeit|rename|umbenenn)/.test(text)) {
    priority = "niedrig";
  }

  const steps = roadmap.split(/\n/).filter((line) => line.trim()).length;
  let score = 0;
  if (desc.length > 300) score += 2;
  else if (desc.length > 120) score += 1;
  if (steps >= 6) score += 2;
  else if (steps >= 3) score += 1;
  if (/(system|migration|inventory|inventar|architektur|framework|integration|jobsystem|job system|komplett|rework|umfangreich|datenmigration|plattform)/.test(text)) {
    score += 2;
  }
  if (/(config|\bwert\b|\bvalue\b|\btext\b|typo|\bfix\b|anpassung|tweak|rename|umbenenn)/.test(text)) {
    score -= 2;
  }
  if (priority === "kritisch") score += 1;
  let type = "mittelprojekt";
  if (score >= 3) type = "grossprojekt";
  else if (score <= -1) type = "kleinprojekt";

  if (typeEl.dataset.manual !== "1") typeEl.value = type;
  if (prioEl.dataset.manual !== "1") prioEl.value = priority;
  const hint = document.querySelector("[data-autohint]");
  if (hint) hint.hidden = typeEl.dataset.manual === "1" && prioEl.dataset.manual === "1";
}

function showTaskForm(task = null) {
  const canAssign = task ? hasPermission("manage_tasks") : hasPermission("create_task");
  const imageCount = Array.isArray(task?.images) ? task.images.length : 0;
  const taskAreaId =
    task?.areaId || (!task && getUserAreaIds().length ? getUserAreaIds()[0] : "");
  openModal(`
    <form id="task-form">
      <h2>${task ? "Aufgabe bearbeiten" : "New task"}</h2>
      <p class="modal-subtitle">Define scope, priority and the planned approach. The assignee sets the due date later.</p>
      <div class="form-grid">
        <div class="field full">
          <label for="task-title">Titel</label>
          <input id="task-title" name="title" maxlength="100" required value="${escapeHtml(task?.title || "")}" placeholder="What should be done?" />
        </div>
        <div class="field full">
          <label for="task-description">Beschreibung <span class="optional-label">optional</span></label>
          <textarea id="task-description" name="description" maxlength="1000" placeholder="Goal and requirements of the task">${escapeHtml(task?.description || "")}</textarea>
        </div>
        <div class="field">
          <label for="task-type">Project size</label>
          <select id="task-type" name="projectType"${task ? ' data-manual="1"' : ""}>
            <option value="kleinprojekt" ${task?.projectType === "kleinprojekt" ? "selected" : ""}>Small project</option>
            <option value="mittelprojekt" ${task?.projectType === "mittelprojekt" ? "selected" : ""}>Medium project</option>
            <option value="grossprojekt" ${task?.projectType === "grossprojekt" ? "selected" : ""}>Large project</option>
          </select>
          <span class="field-hint" data-autohint${task ? " hidden" : ""}>Auto-detected from your input - change it to override.</span>
        </div>
        <div class="field">
          <label for="task-priority">Priority</label>
          <select id="task-priority" name="priority"${task ? ' data-manual="1"' : ""}>
            ${["niedrig", "mittel", "hoch", "kritisch"].map((value) => `<option value="${value}" ${task?.priority === value || (!task && value === "mittel") ? "selected" : ""}>${t("prio." + value)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="task-status">Status</label>
          <select id="task-status" name="status">
            ${Object.entries(statusConfig).map(([value, config]) => `<option value="${value}" ${task?.status === value ? "selected" : ""}>${config.label}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="task-area">Area</label>
          <select id="task-area" name="areaId">
            <option value="">General · no area</option>
            ${state.areas
              .map(
                (area) =>
                  `<option value="${area.id}" ${taskAreaId === area.id ? "selected" : ""}>${escapeHtml(area.name)}</option>`
              )
              .join("")}
          </select>
          <span class="field-hint">Open tasks stay visible to everyone.</span>
        </div>
        ${
          canAssign
            ? `<div class="field full">
                <label for="task-assignee">Zuweisung</label>
                <select id="task-assignee" name="assigneeId">
                  <option value="">Open · ${taskAreaId ? "area can claim" : "anyone can claim"}</option>
                  ${renderTaskAssigneeOptions(taskAreaId, task?.assigneeId)}
                </select>
                <span class="field-hint">Only users belonging to the selected area are shown.</span>
              </div>`
            : ""
        }
        <div class="field full">
          <label for="task-roadmap">Fahrplan / Umsetzung <span class="optional-label">optional</span></label>
          <textarea id="task-roadmap" name="roadmap" maxlength="3000" placeholder="1. Analysis&#10;2. Implementation&#10;3. Tests">${escapeHtml(task?.roadmap || "")}</textarea>
        </div>
        <div class="field full task-image-field">
          <label for="task-images">Bilder</label>
          ${renderExistingTaskImages(task)}
          <label class="task-image-picker" for="task-images">
            <span class="task-image-picker-icon">${iconSvg("plus")}</span>
            <span><strong>Choose images</strong><small>JPEG, PNG, WebP or GIF · max 5 MB per image</small></span>
          </label>
          <input id="task-images" class="task-image-input" name="images" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple data-existing-count="${imageCount}" />
          <div class="task-image-preview" data-task-image-preview></div>
          <span class="field-hint">A task can have at most five images in total.</span>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="button secondary" data-close-modal>Cancel</button>
        <button type="submit" class="button primary">${task ? "Speichern" : "Create task"}</button>
      </div>
      <input type="hidden" name="taskId" value="${escapeHtml(task?.id || "")}" />
    </form>
  `);
}

function showTaskDetail(task) {
  const assignee = getUser(task.assigneeId);
  const area = getArea(task.areaId);
  const mayEdit = hasPermission("manage_tasks");
  const maySetDueDate = isTaskAssignedToCurrentUser(task);
  const maySetArea = isTaskAssignedToCurrentUser(task);
  const maySetStatus = canMoveTask(task);
  const notes = Array.isArray(task.notes) ? [...task.notes] : [];
  const images = Array.isArray(task.images) ? task.images : [];
  openModal(`
    <div>
      <div class="card-flags">
        <span class="pill priority-${task.priority}">${t("prio." + task.priority)}</span>
        <span class="pill">${projectTypeLabel(task.projectType)}</span>
        <span class="pill">${statusConfig[task.status].label}</span>
      </div>
      <h2>${escapeHtml(task.title)}</h2>
      ${task.description ? `<p class="modal-subtitle">${escapeHtml(task.description)}</p>` : ""}
      ${
        images.length
          ? `<div class="task-image-gallery">
              ${images
                .map(
                  (image) => `
                    <a href="${escapeHtml(image.url)}" target="_blank" rel="noopener" title="${escapeHtml(image.originalName || "Open image")}">
                      <img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.originalName || "Aufgabenbild")}" loading="lazy" />
                    </a>
                  `
                )
                .join("")}
            </div>`
          : ""
      }
      ${
        !assignee
          ? `<div class="task-needs-person"><span></span><div><strong>This task still needs an owner</strong><p>${task.areaId ? `The task is unassigned and can be claimed by members of the ${escapeHtml(area?.name || "Unknown")} area.` : "The task is unassigned and can be claimed by a team member."}</p></div></div>`
          : ""
      }
      ${
        task.roadmap
          ? `<div class="task-detail-roadmap">
              <h4>Fahrplan / Umsetzung</h4>
              <p>${escapeHtml(task.roadmap)}</p>
            </div>`
          : ""
      }
      <div class="form-grid">
        <div class="field"><label>Fertigstellungsdatum</label><div>${task.dueDate ? formatDate(task.dueDate, { year: "numeric" }) : "Noch nicht angegeben"}</div></div>
        <div class="field"><label>Assignee</label><div>${assignee ? escapeHtml(assignee.displayName) : "Noch nicht zugewiesen"}</div></div>
        <div class="field"><label>Area</label><div><span class="area-badge" style="--area-color:${area?.color || "#74747f"}"><i></i>${escapeHtml(area?.name || "Allgemein")}</span></div></div>
      </div>
      ${
        !assignee && task.areaId && !canClaimTask(task)
          ? `<div class="task-area-warning">You can see this open task, but only members of the „${escapeHtml(area?.name || "Unknown")}“ area may claim it.</div>`
          : ""
      }
      <section class="task-notes">
        <div class="task-notes-head">
          <div><span class="eyebrow">History</span><h3>Notes</h3></div>
          <span class="pill">${notes.length}</span>
        </div>
        <div class="task-note-list">
          ${
            notes.length
              ? notes
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                  .map(renderTaskNote)
                  .join("")
              : `<div class="task-note-empty">No notes on this task yet.</div>`
          }
        </div>
        <form id="task-note-form" class="task-note-form">
          <label for="task-note-text">New note</label>
          <textarea id="task-note-text" name="text" maxlength="1500" required placeholder="Note progress, questions or important information..."></textarea>
          <div class="task-note-form-foot">
            <span>Every approved user can add notes.</span>
            <button class="button primary" type="submit">Save note</button>
          </div>
          <input type="hidden" name="taskId" value="${task.id}" />
        </form>
      </section>
      <div class="modal-actions">
        ${
          hasPermission("manage_tasks")
            ? `<button class="button danger" data-action="delete-task" data-id="${task.id}">Delete task</button>`
            : ""
        }
        ${
          !assignee && hasPermission("claim_task") && canClaimTask(task)
            ? `<button class="button secondary" data-action="claim-task" data-id="${task.id}">Claim task</button>`
            : ""
        }
        ${
          maySetDueDate
            ? `<button class="button secondary" data-action="set-task-due-date" data-id="${task.id}">${task.dueDate ? "Change date" : "Set date"}</button>`
            : ""
        }
        ${
          maySetArea
            ? `<button class="button secondary" data-action="set-task-area" data-id="${task.id}">Change area</button>`
            : ""
        }
        ${
          maySetStatus
            ? `<button class="button secondary" data-action="set-task-status" data-id="${task.id}">Change status</button>`
            : ""
        }
        ${mayEdit ? `<button class="button primary" data-action="edit-task" data-id="${task.id}">Bearbeiten</button>` : ""}
      </div>
    </div>
  `);
}

function renderTaskNote(note) {
  const author = getUser(note.authorId);
  return `
    <article class="task-note">
      <div class="task-note-author">
        ${avatar(author || { displayName: note.authorName, avatar: null }, "small")}
        <div>
          <strong>${escapeHtml(note.authorName || author?.displayName || "Unbekannt")}</strong>
          <span>${formatDateTime(note.createdAt)}</span>
        </div>
      </div>
      <p>${escapeHtml(note.text)}</p>
    </article>
  `;
}

function showTaskDueDateForm(task) {
  openModal(`
    <form id="task-due-date-form">
      <h2>Fertigstellungsdatum festlegen</h2>
      <p class="modal-subtitle">You are assigned to this task and decide when you expect to finish it.</p>
      <div class="field">
        <label for="assigned-task-due">Fertigstellungsdatum</label>
        <input id="assigned-task-due" name="dueDate" type="date" required value="${escapeHtml(task.dueDate || "")}" />
      </div>
      <div class="modal-actions">
        <button type="button" class="button secondary" data-close-modal>Cancel</button>
        <button type="submit" class="button primary">Save date</button>
      </div>
      <input type="hidden" name="taskId" value="${task.id}" />
    </form>
  `);
}

function showTaskAreaForm(task) {
  const availableAreas = state.areas.filter((area) => getUserAreaIds().includes(area.id));
  openModal(`
    <form id="task-area-form">
      <h2>Change task area</h2>
      <p class="modal-subtitle">You can move your task into one of your areas or keep it as a general task.</p>
      <div class="field">
        <label for="assigned-task-area">Area</label>
        <select id="assigned-task-area" name="areaId">
          <option value="" ${task.areaId ? "" : "selected"}>General · no area</option>
          ${availableAreas
            .map(
              (area) =>
                `<option value="${area.id}" ${task.areaId === area.id ? "selected" : ""}>${escapeHtml(area.name)}</option>`
            )
            .join("")}
        </select>
        <span class="field-hint">Only the areas you are assigned to are available.</span>
      </div>
      <div class="modal-actions">
        <button type="button" class="button secondary" data-close-modal>Cancel</button>
        <button type="submit" class="button primary">Save area</button>
      </div>
      <input type="hidden" name="taskId" value="${task.id}" />
    </form>
  `);
}

function showTaskStatusForm(task) {
  openModal(`
    <form id="task-status-form">
      <h2>Change task status</h2>
      <p class="modal-subtitle">Move the task straight into the desired status column.</p>
      <div class="field">
        <label for="assigned-task-status">Status</label>
        <select id="assigned-task-status" name="status">
          ${Object.entries(statusConfig)
            .map(
              ([value, config]) =>
                `<option value="${value}" ${task.status === value ? "selected" : ""}>${config.label}</option>`
            )
            .join("")}
        </select>
      </div>
      <div class="modal-actions">
        <button type="button" class="button secondary" data-close-modal>Cancel</button>
        <button type="submit" class="button primary">Save status</button>
      </div>
      <input type="hidden" name="taskId" value="${task.id}" />
    </form>
  `);
}

function showDeleteTaskConfirm(task) {
  openModal(`
    <div class="confirm-dialog">
      <span class="confirm-icon">×</span>
      <h2>Delete task?</h2>
      <p class="modal-subtitle">The task <strong>${escapeHtml(task.title)}</strong> will be permanently removed. This action cannot be undone.</p>
      <div class="delete-preview">
        <span class="pill priority-${task.priority}">${t("prio." + task.priority)}</span>
        <strong>${escapeHtml(task.description)}</strong>
      </div>
      <div class="modal-actions">
        <button type="button" class="button secondary" data-close-modal>Cancel</button>
        <button type="button" class="button danger" data-action="confirm-delete-task" data-id="${task.id}">Delete permanently</button>
      </div>
    </div>
  `);
}

function showChangeForm(entry = null) {
  openModal(`
    <form id="change-form">
      <h2>${entry ? "Edit changelog" : "Submit changelog"}</h2>
      <p class="modal-subtitle">${entry ? "Fix the wording and prepare the entry for approval." : "The entry is visible immediately and stays marked with an X until approved."}</p>
      <div class="form-grid">
        <div class="field">
          <label for="change-type">Change</label>
          <select id="change-type" name="type">
            ${Object.entries(typeLabels).map(([value, label]) => `<option value="${value}" ${entry?.type === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="change-script">Skript-Name</label>
          <input id="change-script" name="scriptName" maxlength="80" required value="${escapeHtml(entry?.scriptName || "")}" placeholder="z. B. oxcore" />
        </div>
        <div class="field full">
          <label for="change-description">What changed?</label>
          <textarea id="change-description" name="description" maxlength="500" required placeholder="Short, clear description">${escapeHtml(entry?.description || "")}</textarea>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="button secondary" data-close-modal>Cancel</button>
        <button type="submit" class="button primary">${entry ? "Save change" : "Submit for review"}</button>
      </div>
      <input type="hidden" name="entryId" value="${escapeHtml(entry?.id || "")}" />
    </form>
  `);
}

function showUserForm(user) {
  const selectedAreaIds = new Set(getUserAreaIds(user));
  openModal(`
    <form id="user-form">
      <h2>${user.approved ? "Edit access" : "Approve users"}</h2>
      <p class="modal-subtitle">${escapeHtml(user.displayName)} receives the permissions of the selected role and can be assigned to multiple areas.</p>
      <div class="field">
        <label for="user-group">Gruppe</label>
        <select id="user-group" name="groupId">
          ${state.groups.map((group) => `<option value="${group.id}" ${user.groupId === group.id ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>Areas</label>
        ${
          state.areas.length
            ? `<div class="permission-grid area-selection-grid">
                ${state.areas
                  .map(
                    (area) => `
                      <label class="permission-option">
                        <input type="checkbox" name="areaIds" value="${area.id}" ${selectedAreaIds.has(area.id) ? "checked" : ""} />
                        <span>
                          <strong>${escapeHtml(area.name)}</strong>
                          <small>User may take on tasks of this area.</small>
                        </span>
                      </label>
                    `
                  )
                  .join("")}
              </div>`
            : `<span class="field-hint">No areas have been created yet. Without an area a user sees all tasks by default.</span>`
        }
      </div>
      <div id="permission-preview" class="task-detail-roadmap"></div>
      <div class="modal-actions">
        ${
          user.id !== state.me.id
            ? `<button type="button" class="button danger" data-action="delete-user" data-id="${user.id}">${user.approved ? "Delete user" : "Reject request"}</button>`
            : ""
        }
        ${
          user.approved && user.id !== state.me.id
            ? `<button type="button" class="button ghost danger-text" data-action="revoke-user" data-id="${user.id}">Revoke access</button>`
            : ""
        }
        <button type="submit" class="button primary">${user.approved ? "Save" : "Approve"}</button>
      </div>
      <input type="hidden" name="userId" value="${user.id}" />
    </form>
  `);
  renderPermissionPreview();
}

function showDeleteUserConfirm(user) {
  if (!user) return;
  openModal(`
    <div class="confirm-dialog">
      <h2>${user.approved ? "Delete user?" : "Reject request?"}</h2>
      <p class="modal-subtitle"><strong>${escapeHtml(user.displayName)}</strong> will be permanently removed. This action cannot be undone.</p>
      <div class="modal-actions">
        <button class="button ghost" data-close-modal>Cancel</button>
        <button class="button danger" data-action="confirm-delete-user" data-id="${user.id}">${user.approved ? "Delete" : "Reject"}</button>
      </div>
    </div>
  `);
}

function showAreaForm(area = null) {
  openModal(`
    <form id="area-form">
      <h2>${area ? "Edit area" : "New area"}</h2>
      <p class="modal-subtitle">Areas connect users with the tasks they may take on.</p>
      <div class="form-grid">
        <div class="field">
          <label for="area-name">Bereichsname</label>
          <input id="area-name" name="name" maxlength="60" required value="${escapeHtml(area?.name || "")}" placeholder="z. B. Fahrzeuge" />
        </div>
        <div class="field">
          <label for="area-color">Farbe</label>
          <div class="color-field">
            <input id="area-color" name="color" type="color" value="${escapeHtml(area?.color || "#38bdf8")}" />
            <span data-area-color-value>${escapeHtml(area?.color || "#38bdf8")}</span>
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="button secondary" data-close-modal>Cancel</button>
        <button type="submit" class="button primary">${area ? "Save changes" : "Create area"}</button>
      </div>
      <input type="hidden" name="areaId" value="${escapeHtml(area?.id || "")}" />
    </form>
  `);
}

function showDeleteAreaConfirm(area) {
  openModal(`
    <div class="confirm-dialog">
      <span class="confirm-icon">×</span>
      <h2>Delete area?</h2>
      <p class="modal-subtitle">The area <strong>${escapeHtml(area.name)}</strong> will be permanently removed. Areas in use cannot be deleted.</p>
      <div class="modal-actions">
        <button type="button" class="button secondary" data-close-modal>Cancel</button>
        <button type="button" class="button danger" data-action="confirm-delete-area" data-id="${area.id}">Delete permanently</button>
      </div>
    </div>
  `);
}

function showGroupForm(group = null) {
  const selectedPermissions = new Set(group?.permissions || []);
  openModal(`
    <form id="group-form">
      <h2>${group ? "Edit role" : "New role"}</h2>
      <p class="modal-subtitle">Choose the permissions that all members of this role should receive.</p>
      <div class="form-grid">
        <div class="field">
          <label for="group-name">Gruppenname</label>
          <input id="group-name" name="name" maxlength="60" required value="${escapeHtml(group?.name || "")}" placeholder="z. B. Projektleitung" />
        </div>
        <div class="field">
          <label for="group-color">Farbe</label>
          <div class="color-field">
            <input id="group-color" name="color" type="color" value="${escapeHtml(group?.color || "#7c3aed")}" />
            <span data-color-value>${escapeHtml(group?.color || "#7c3aed")}</span>
          </div>
        </div>
        <div class="field full">
          <label>Funktionsrechte</label>
          <div class="permission-grid">
            ${state.permissionCatalog
              .map(
                (permission) => `
                  <label class="permission-option">
                    <input type="checkbox" name="permissions" value="${permission.id}" ${selectedPermissions.has(permission.id) ? "checked" : ""} />
                    <span>
                      <strong>${escapeHtml(permission.name)}</strong>
                      <small>${escapeHtml(permission.description)}</small>
                    </span>
                  </label>
                `
              )
              .join("")}
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="button secondary" data-close-modal>Cancel</button>
        <button type="submit" class="button primary">${group ? "Save changes" : "Gruppe erstellen"}</button>
      </div>
      <input type="hidden" name="groupId" value="${escapeHtml(group?.id || "")}" />
    </form>
  `);
}

function showDeleteGroupConfirm(group) {
  openModal(`
    <div class="confirm-dialog">
      <span class="confirm-icon">×</span>
      <h2>Delete role?</h2>
      <p class="modal-subtitle">The role <strong>${escapeHtml(group.name)}</strong> will be permanently removed. Roles in use cannot be deleted for security reasons.</p>
      <div class="modal-actions">
        <button type="button" class="button secondary" data-close-modal>Cancel</button>
        <button type="button" class="button danger" data-action="confirm-delete-group" data-id="${group.id}">Delete permanently</button>
      </div>
    </div>
  `);
}

function renderPermissionPreview() {
  const select = document.querySelector("#user-group");
  const target = document.querySelector("#permission-preview");
  if (!select || !target) return;
  const group = getGroup(select.value);
  target.innerHTML = `
    <h4>Included permissions</h4>
    <p>${group.permissions.map((permission) => `• ${permissionLabels[permission] || permission}`).join("\n")}</p>
  `;
}

function showPushForm() {
  const defaultDate = new Date(Date.now() + 30 * 60 * 1000);
  defaultDate.setMinutes(defaultDate.getMinutes() - defaultDate.getTimezoneOffset());
  const unpublished = state.changelogs.length;
  const pending = state.changelogs.filter((entry) => !entry.approved).length;
  openModal(`
    <form id="push-form">
      <h2>Publish changelog</h2>
      <p class="modal-subtitle">${unpublished} entries are sent as a Discord embed and then moved to „Past changelogs“.</p>
      <div class="field">
        <label for="effective-at">Changelog applies from the restart at</label>
        <input id="effective-at" name="effectiveAt" type="datetime-local" required value="${defaultDate.toISOString().slice(0, 16)}" />
        <span class="field-hint">Discord shows this time to every user in their local time zone.</span>
      </div>
      ${
        state.settings.webhookConfigured
          ? ""
          : `<div class="task-detail-roadmap"><h4>Webhook missing</h4><p>Add DISCORD_WEBHOOK_URL to the server's .env file.</p></div>`
      }
      ${
        pending
          ? `<div class="push-warning"><strong>${pending} approvals missing</strong><span>Before the push every entry has to be approved by the lead.</span></div>`
          : ""
      }
      <div class="modal-actions">
        <button type="button" class="button secondary" data-close-modal>Cancel</button>
        <button type="submit" class="button primary" ${!state.settings.webhookConfigured || !unpublished || pending ? "disabled" : ""}>An Discord senden</button>
      </div>
    </form>
  `);
}

function showDeleteChangeConfirm(entry) {
  openModal(`
    <div class="confirm-dialog">
      <span class="confirm-icon">×</span>
      <h2>Delete changelog entry?</h2>
      <p class="modal-subtitle">The entry <strong>${escapeHtml(entry.scriptName)}</strong> will be permanently removed. This action cannot be undone.</p>
      <div class="delete-preview">
        <span class="change-type ${entry.type}">${typeLabels[entry.type]}</span>
        <strong>${escapeHtml(entry.description)}</strong>
      </div>
      <div class="modal-actions">
        <button type="button" class="button secondary" data-close-modal>Cancel</button>
        <button type="button" class="button danger" data-action="confirm-delete-change" data-id="${entry.id}">Delete permanently</button>
      </div>
    </div>
  `);
}

function clearTaskDropTargets() {
  document.querySelectorAll(".board-column.is-drop-target").forEach((column) => {
    column.classList.remove("is-drop-target");
  });
}

function markTaskDropTarget(column) {
  clearTaskDropTargets();
  if (column && column.dataset.taskStatus !== dragState.sourceStatus) {
    column.classList.add("is-drop-target");
  }
}

function resetTaskDragState() {
  clearTaskDropTargets();
  dragState.card?.classList.remove("is-dragging");
  dragState.ghost?.remove();
  document.body.classList.remove("task-pointer-dragging");
  dragState.taskId = null;
  dragState.sourceStatus = null;
  dragState.pointerId = null;
  dragState.ghost = null;
  dragState.card = null;
  dragState.moved = false;
}

async function moveTaskToStatus(taskId, targetStatus) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task || !statusConfig[targetStatus] || task.status === targetStatus) return;
  const previousStatus = task.status;
  task.status = targetStatus;
  renderShell();
  try {
    await api(`/api/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "set_status", status: targetStatus })
    });
    toast(`Aufgabe wurde nach „${statusConfig[targetStatus].label}“ verschoben.`);
  } catch (error) {
    task.status = previousStatus;
    renderShell();
    toast(error.message, "error");
  }
}

document.addEventListener("dragstart", (event) => {
  const card = event.target.closest(".task-card[draggable='true']");
  const task = state.tasks.find((item) => item.id === card?.dataset.taskId);
  if (!card || !canMoveTask(task)) return;
  dragState.taskId = card.dataset.taskId;
  dragState.sourceStatus = card.dataset.taskStatus;
  dragState.card = card;
  dragState.moved = true;
  card.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", card.dataset.taskId);
});

document.addEventListener("dragover", (event) => {
  if (!dragState.taskId) return;
  const column = event.target.closest("[data-task-status]");
  if (!column) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  markTaskDropTarget(column);
});

document.addEventListener("dragleave", (event) => {
  const column = event.target.closest("[data-task-status]");
  if (column && !column.contains(event.relatedTarget)) column.classList.remove("is-drop-target");
});

document.addEventListener("drop", (event) => {
  const column = event.target.closest("[data-task-status]");
  if (!column || !dragState.taskId) return;
  event.preventDefault();
  const taskId = dragState.taskId;
  const targetStatus = column.dataset.taskStatus;
  dragState.suppressClickUntil = Date.now() + 350;
  resetTaskDragState();
  moveTaskToStatus(taskId, targetStatus);
});

document.addEventListener("dragend", () => {
  if (dragState.moved) dragState.suppressClickUntil = Date.now() + 350;
  resetTaskDragState();
});

document.addEventListener("pointerdown", (event) => {
  const handle = event.target.closest("[data-drag-handle]");
  if (!handle || event.pointerType === "mouse") return;
  const card = handle.closest("[data-task-id]");
  const task = state.tasks.find((item) => item.id === card?.dataset.taskId);
  if (!card || !canMoveTask(task)) return;
  event.preventDefault();
  event.stopPropagation();

  const rect = card.getBoundingClientRect();
  const ghost = card.cloneNode(true);
  ghost.classList.add("task-drag-ghost");
  ghost.classList.remove("is-dragging");
  ghost.removeAttribute("draggable");
  ghost.style.width = `${rect.width}px`;
  document.body.appendChild(ghost);

  dragState.taskId = card.dataset.taskId;
  dragState.sourceStatus = card.dataset.taskStatus;
  dragState.pointerId = event.pointerId;
  dragState.ghost = ghost;
  dragState.card = card;
  dragState.moved = true;
  card.classList.add("is-dragging");
  document.body.classList.add("task-pointer-dragging");
  ghost.style.transform = `translate3d(${event.clientX - rect.width / 2}px, ${event.clientY - 30}px, 0)`;
  handle.setPointerCapture?.(event.pointerId);
});

document.addEventListener("pointermove", (event) => {
  if (dragState.pointerId !== event.pointerId || !dragState.ghost) return;
  event.preventDefault();
  const width = dragState.ghost.getBoundingClientRect().width;
  dragState.ghost.style.transform = `translate3d(${event.clientX - width / 2}px, ${event.clientY - 30}px, 0)`;
  const board = document.querySelector(".board");
  if (board) {
    if (event.clientX < 56) board.scrollBy({ left: -18 });
    if (event.clientX > window.innerWidth - 56) board.scrollBy({ left: 18 });
  }
  markTaskDropTarget(document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-task-status]"));
});

document.addEventListener("pointerup", (event) => {
  if (dragState.pointerId !== event.pointerId) return;
  const column = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-task-status]");
  const taskId = dragState.taskId;
  const targetStatus = column?.dataset.taskStatus;
  dragState.suppressClickUntil = Date.now() + 350;
  resetTaskDragState();
  if (taskId && targetStatus) moveTaskToStatus(taskId, targetStatus);
});

document.addEventListener("pointercancel", (event) => {
  if (dragState.pointerId !== event.pointerId) return;
  dragState.suppressClickUntil = Date.now() + 350;
  resetTaskDragState();
});

document.addEventListener("click", async (event) => {
  const pageButton = event.target.closest("[data-page]");
  if (pageButton) {
    state.page = pageButton.dataset.page;
    document.body.classList.remove("menu-open");
    renderShell();
    return;
  }

  const authTab = event.target.closest("[data-auth-tab]");
  if (authTab) {
    const tab = authTab.dataset.authTab;
    document.querySelectorAll("[data-auth-tab]").forEach((element) =>
      element.classList.toggle("active", element === authTab)
    );
    document.querySelectorAll("[data-auth-panel]").forEach((element) => {
      element.hidden = element.dataset.authPanel !== tab;
    });
    return;
  }

  const taskCard = event.target.closest("[data-task-id]");
  if (taskCard && !event.target.closest("button")) {
    if (Date.now() < dragState.suppressClickUntil) return;
    showTaskDetail(state.tasks.find((task) => task.id === taskCard.dataset.taskId));
    return;
  }

  const button = event.target.closest("[data-action], [data-close-modal]");
  if (!button) return;
  if (button.hasAttribute("data-close-modal")) {
    closeModal();
    return;
  }

  const action = button.dataset.action;
  try {
    if (action === "discord-login") {
      location.href = "/auth/discord";
    } else if (action === "demo-login") {
      await api("/api/demo-login", {
        method: "POST",
        body: "{}"
      });
      history.replaceState({}, "", "/?loginPrompt=1");
      await initialize();
    } else if (action === "set-login-persistence") {
      const remember = button.dataset.remember === "true";
      await api("/api/session/remember", {
        method: "POST",
        body: JSON.stringify({ remember })
      });
      state.loginPromptActive = false;
      closeModal();
      toast(remember ? "You stay signed in for 30 days." : "You are signed in for this browser session only.");
      setTimeout(maybeStartTutorial, 180);
    } else if (action === "logout") {
      await api("/api/logout", { method: "POST", body: "{}" });
      state.me = null;
      state.taskArea = "alle";
      state.taskScope = null;
      state.taskScopeUserId = null;
      state.taskScopeHasAreas = null;
      renderLogin();
    } else if (action === "refresh-session") {
      await initialize();
    } else if (action === "refresh-data") {
      await refreshData();
      toast("Data was refreshed.");
    } else if (action === "toggle-menu") {
      document.body.classList.toggle("menu-open");
    } else if (action === "start-tutorial") {
      startTutorial();
    } else if (action === "tutorial-next") {
      tutorial.index += 1;
      renderTutorialStep();
    } else if (action === "tutorial-back") {
      tutorial.index = Math.max(0, tutorial.index - 1);
      renderTutorialStep();
    } else if (action === "tutorial-finish") {
      await finishTutorial();
    } else if (action === "new-task") {
      showTaskForm();
    } else if (action === "new-idea") {
      showIdeaForm();
    } else if (action === "new-bug") {
      showBugForm();
    } else if (action === "convert-idea") {
      showSourceTaskForm(
        "idea",
        state.ideas.find((idea) => idea.id === button.dataset.id)
      );
    } else if (action === "convert-bug") {
      showSourceTaskForm(
        "bug",
        state.bugs.find((bug) => bug.id === button.dataset.id)
      );
    } else if (action === "view-linked-task") {
      const task = state.tasks.find((item) => item.id === button.dataset.id);
      if (task) showTaskDetail(task);
    } else if (action === "edit-task") {
      showTaskForm(state.tasks.find((task) => task.id === button.dataset.id));
    } else if (action === "set-task-due-date") {
      showTaskDueDateForm(state.tasks.find((task) => task.id === button.dataset.id));
    } else if (action === "set-task-area") {
      showTaskAreaForm(state.tasks.find((task) => task.id === button.dataset.id));
    } else if (action === "set-task-status") {
      showTaskStatusForm(state.tasks.find((task) => task.id === button.dataset.id));
    } else if (action === "delete-task") {
      showDeleteTaskConfirm(state.tasks.find((task) => task.id === button.dataset.id));
    } else if (action === "confirm-delete-task") {
      await api(`/api/tasks/${button.dataset.id}`, { method: "DELETE" });
      closeModal();
      await refreshData();
      toast("Task was deleted.");
    } else if (action === "claim-task") {
      await api(`/api/tasks/${button.dataset.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "claim" })
      });
      closeModal();
      await refreshData();
      toast("Task was assigned to you.");
    } else if (action === "new-change") {
      showChangeForm();
    } else if (action === "edit-change") {
      showChangeForm(state.changelogs.find((entry) => entry.id === button.dataset.id));
    } else if (action === "delete-change") {
      showDeleteChangeConfirm(state.changelogs.find((entry) => entry.id === button.dataset.id));
    } else if (action === "confirm-delete-change") {
      await api(`/api/changelogs/${button.dataset.id}`, { method: "DELETE" });
      closeModal();
      await refreshData();
      toast("Changelog entry was deleted.");
    } else if (action === "approve-change") {
      await api(`/api/changelogs/${button.dataset.id}`, {
        method: "PATCH",
        body: JSON.stringify({ approved: true })
      });
      await refreshData();
      toast("Changelog entry was approved.");
    } else if (action === "manage-user") {
      showUserForm(state.users.find((user) => user.id === button.dataset.id));
    } else if (action === "new-group") {
      showGroupForm();
    } else if (action === "new-area") {
      showAreaForm();
    } else if (action === "edit-area") {
      showAreaForm(state.areas.find((area) => area.id === button.dataset.id));
    } else if (action === "delete-area") {
      showDeleteAreaConfirm(state.areas.find((area) => area.id === button.dataset.id));
    } else if (action === "confirm-delete-area") {
      await api(`/api/areas/${button.dataset.id}`, { method: "DELETE" });
      closeModal();
      await refreshData();
      toast("Area was deleted.");
    } else if (action === "edit-group") {
      showGroupForm(state.groups.find((group) => group.id === button.dataset.id));
    } else if (action === "delete-group") {
      showDeleteGroupConfirm(state.groups.find((group) => group.id === button.dataset.id));
    } else if (action === "confirm-delete-group") {
      await api(`/api/groups/${button.dataset.id}`, { method: "DELETE" });
      closeModal();
      await refreshData();
      toast("Role was deleted.");
    } else if (action === "revoke-user") {
      const user = state.users.find((item) => item.id === button.dataset.id);
      await api(`/api/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ approved: false, groupId: user.groupId || "mitarbeiter" })
      });
      closeModal();
      await refreshData();
      toast("Access was revoked.");
    } else if (action === "delete-user") {
      showDeleteUserConfirm(state.users.find((item) => item.id === button.dataset.id));
    } else if (action === "confirm-delete-user") {
      await api(`/api/users/${button.dataset.id}`, { method: "DELETE" });
      closeModal();
      await refreshData();
      toast("User was removed.");
    } else if (action === "push-changelog") {
      showPushForm();
    } else if (action === "delete-status") {
      await api(`/api/statuses/${button.dataset.id}`, { method: "DELETE" });
      await refreshData();
      toast("Status was deleted.");
    } else if (action === "set-default-status") {
      await api(`/api/statuses/${button.dataset.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isDefault: true })
      });
      await refreshData();
      toast("Default status was set.");
    } else if (action === "delete-token") {
      await api(`/api/tokens/${button.dataset.id}`, { method: "DELETE" });
      await refreshData();
      toast("Token was revoked.");
    } else if (action === "status-move") {
      await api(`/api/statuses/${button.dataset.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "reorder", direction: button.dataset.dir })
      });
      await refreshData();
    } else if (action === "group-move") {
      await api(`/api/groups/${button.dataset.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "reorder", direction: button.dataset.dir })
      });
      await refreshData();
    }
  } catch (error) {
    toast(error.message, "error");
  }
});

async function saveStatusField(id, body) {
  try {
    await api(`/api/statuses/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    await refreshData();
  } catch (error) {
    toast(error.message, "error");
  }
}

document.addEventListener("input", (event) => {
  if (event.target.matches("#task-title, #task-description, #task-roadmap")) {
    autoDetectTask();
  }
  if (event.target.matches("[data-task-search]")) {
    state.taskSearch = event.target.value;
    const cursor = event.target.selectionStart;
    renderShell();
    const input = document.querySelector("[data-task-search]");
    input?.focus();
    input?.setSelectionRange(cursor, cursor);
  }
  if (event.target.matches("#group-color")) {
    const value = document.querySelector("[data-color-value]");
    if (value) value.textContent = event.target.value;
  }
  if (event.target.matches("#area-color")) {
    const value = document.querySelector("[data-area-color-value]");
    if (value) value.textContent = event.target.value;
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("#task-type, #task-priority")) {
    event.target.dataset.manual = "1";
    const hint = document.querySelector("[data-autohint]");
    if (hint) hint.hidden = true;
  }
  if (event.target.matches("[data-status-name]")) {
    saveStatusField(event.target.dataset.statusName, { name: event.target.value });
    return;
  }
  if (event.target.matches("[data-status-color]")) {
    saveStatusField(event.target.dataset.statusColor, { color: event.target.value });
    return;
  }
  if (event.target.matches("[data-task-scope]")) {
    state.taskScope = event.target.value;
    renderShell();
  }
  if (event.target.matches("[data-task-priority]")) {
    state.taskPriority = event.target.value;
    renderShell();
  }
  if (event.target.matches("[data-task-area-filter]")) {
    state.taskArea = event.target.value;
    renderShell();
  }
  if (event.target.matches("#user-group")) renderPermissionPreview();
  if (event.target.matches("#task-area")) {
    const assigneeSelect = document.querySelector("#task-assignee");
    if (assigneeSelect) {
      const selectedId = assigneeSelect.value;
      assigneeSelect.innerHTML = `
        <option value="">Open · ${event.target.value ? "area can claim" : "anyone can claim"}</option>
        ${renderTaskAssigneeOptions(event.target.value, selectedId)}
      `;
    }
  }
  if (event.target.matches("#task-images")) {
    const input = event.target;
    const preview = document.querySelector("[data-task-image-preview]");
    const files = [...input.files];
    const existingCount = Number(input.dataset.existingCount || 0);
    const selectedForRemoval = document.querySelectorAll(
      'input[name="removeImageIds"]:checked'
    ).length;
    const availableSlots = 5 - (existingCount - selectedForRemoval);
    if (files.length > availableSlots) {
      input.value = "";
      if (preview) preview.innerHTML = "";
      toast(
        `You can add ${Math.max(0, availableSlots)} more image${availableSlots === 1 ? "" : "s"}.`,
        "error"
      );
      return;
    }
    Promise.all(files.map(readImageFile))
      .then((sources) => {
        if (!preview) return;
        preview.innerHTML = sources
          .map(
            (source, index) => `
              <div class="task-image-preview-item">
                <img src="${source}" alt="" />
                <span title="${escapeHtml(files[index].name)}">${escapeHtml(files[index].name)}</span>
              </div>
            `
          )
          .join("");
      })
      .catch((error) => {
        input.value = "";
        if (preview) preview.innerHTML = "";
        toast(error.message, "error");
      });
  }
  if (event.target.matches("#bug-media")) {
    const input = event.target;
    const info = document.querySelector("[data-report-file-info]");
    const file = input.files[0];
    if (!file) {
      if (info) info.innerHTML = "";
      return;
    }
    try {
      validateReportMedia(file);
      if (info) {
        info.innerHTML = `
          <span>${escapeHtml(file.name)}</span>
          <small>${formatFileSize(file.size)}</small>
        `;
      }
    } catch (error) {
      input.value = "";
      if (info) info.innerHTML = "";
      toast(error.message, "error");
    }
  }
});

document.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(form));
    if (form.id === "login-form") {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: values.username,
          password: values.password,
          remember: form.querySelector("[name='remember']")?.checked === true
        })
      });
      await initialize();
      return;
    } else if (form.id === "register-form") {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: values.username,
          displayName: values.displayName,
          password: values.password,
          remember: form.querySelector("[name='remember']")?.checked === true
        })
      });
      await initialize();
      return;
    } else if (form.id === "task-form") {
      const formData = new FormData(form);
      const imageFiles = formData
        .getAll("images")
        .filter((file) => file instanceof File && file.size);
      const removeImageIds = formData.getAll("removeImageIds");
      const existingImageCount = Number(
        form.querySelector("#task-images")?.dataset.existingCount || 0
      );
      if (existingImageCount - removeImageIds.length + imageFiles.length > 5) {
        throw new Error("A task can have at most five images.");
      }
      const taskId = values.taskId;
      delete values.taskId;
      delete values.images;
      delete values.removeImageIds;
      const result = await api(taskId ? `/api/tasks/${taskId}` : "/api/tasks", {
        method: taskId ? "PATCH" : "POST",
        body: JSON.stringify(values)
      });
      const savedTaskId = result.task.id;
      for (const imageId of removeImageIds) {
        await api(`/api/tasks/${savedTaskId}/images/${imageId}`, { method: "DELETE" });
      }
      await uploadTaskImages(savedTaskId, imageFiles);
      closeModal();
      await refreshData();
      toast(
        taskId
          ? `Aufgabe wurde gespeichert${imageFiles.length ? " and images were uploaded" : ""}.`
          : `Task was created${imageFiles.length ? " and images were uploaded" : ""}.`
      );
    } else if (form.id === "idea-form") {
      await api("/api/ideas", {
        method: "POST",
        body: JSON.stringify({ text: values.text })
      });
      closeModal();
      await refreshData();
      toast("Idea was submitted.");
    } else if (form.id === "bug-form") {
      const formData = new FormData(form);
      const media = formData.get("media");
      const result = await api("/api/bugs", {
        method: "POST",
        body: JSON.stringify({
          subject: values.subject,
          description: values.description,
          importance: values.importance
        })
      });
      let uploadError = null;
      if (media instanceof File && media.size) {
        const progress = form.querySelector("[data-report-upload-progress]");
        const progressBar = progress?.querySelector("progress");
        const percent = progress?.querySelector("[data-report-upload-percent]");
        const label = progress?.querySelector("[data-report-upload-label]");
        if (progress) progress.hidden = false;
        if (label) label.textContent = "Image or video is uploading...";
        try {
          await uploadBugMedia(result.bug.id, media, (value) => {
            if (progressBar) progressBar.value = value;
            if (percent) percent.textContent = `${value} %`;
          });
        } catch (error) {
          uploadError = error;
        }
      }
      closeModal();
      await refreshData();
      if (uploadError) {
        toast(`Bug wurde gespeichert, aber der Anhang nicht: ${uploadError.message}`, "error");
      } else {
        toast("Bug report was submitted.");
      }
    } else if (form.id === "source-task-form") {
      const sourceType = values.sourceType;
      const sourceId = values.sourceId;
      delete values.sourceType;
      delete values.sourceId;
      await api(`/api/${sourceType === "idea" ? "ideas" : "bugs"}/${sourceId}/convert`, {
        method: "POST",
        body: JSON.stringify(values)
      });
      closeModal();
      await refreshData();
      toast(`${sourceType === "idea" ? "Idee" : "Bug"} wurde als Aufgabe angelegt.`);
    } else if (form.id === "task-due-date-form") {
      await api(`/api/tasks/${values.taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "set_due_date", dueDate: values.dueDate })
      });
      closeModal();
      await refreshData();
      toast("Due date was saved.");
    } else if (form.id === "task-area-form") {
      await api(`/api/tasks/${values.taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "set_area", areaId: values.areaId })
      });
      closeModal();
      await refreshData();
      toast("Task area was saved.");
    } else if (form.id === "task-status-form") {
      await api(`/api/tasks/${values.taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "set_status", status: values.status })
      });
      closeModal();
      await refreshData();
      toast(`Aufgabe wurde nach „${statusConfig[values.status].label}“ verschoben.`);
    } else if (form.id === "task-note-form") {
      const result = await api(`/api/tasks/${values.taskId}/notes`, {
        method: "POST",
        body: JSON.stringify({ text: values.text })
      });
      const taskIndex = state.tasks.findIndex((task) => task.id === values.taskId);
      if (taskIndex >= 0) state.tasks[taskIndex] = result.task;
      renderShell();
      showTaskDetail(result.task);
      toast("Note was saved.");
    } else if (form.id === "change-form") {
      const entryId = values.entryId;
      delete values.entryId;
      await api(entryId ? `/api/changelogs/${entryId}` : "/api/changelogs", {
        method: entryId ? "PATCH" : "POST",
        body: JSON.stringify(values)
      });
      closeModal();
      await refreshData();
      toast(entryId ? "Entry was updated." : "Entry now awaits approval.");
    } else if (form.id === "user-form") {
      const formData = new FormData(form);
      await api(`/api/users/${values.userId}`, {
        method: "PATCH",
        body: JSON.stringify({
          groupId: values.groupId,
          areaIds: formData.getAll("areaIds"),
          approved: true
        })
      });
      closeModal();
      await refreshData();
      toast("User permissions were saved.");
    } else if (form.id === "area-form") {
      const areaId = values.areaId;
      delete values.areaId;
      await api(areaId ? `/api/areas/${areaId}` : "/api/areas", {
        method: areaId ? "PATCH" : "POST",
        body: JSON.stringify(values)
      });
      closeModal();
      await refreshData();
      toast(areaId ? "Area was updated." : "Area was created.");
    } else if (form.id === "group-form") {
      const formData = new FormData(form);
      const groupId = formData.get("groupId");
      await api(groupId ? `/api/groups/${groupId}` : "/api/groups", {
        method: groupId ? "PATCH" : "POST",
        body: JSON.stringify({
          name: formData.get("name"),
          color: formData.get("color"),
          permissions: formData.getAll("permissions")
        })
      });
      closeModal();
      await refreshData();
      toast(groupId ? "Role was updated." : "Role was created.");
    } else if (form.id === "push-form") {
      await api("/api/changelogs/push", {
        method: "POST",
        body: JSON.stringify({ effectiveAt: new Date(values.effectiveAt).toISOString() })
      });
      closeModal();
      await refreshData();
      toast("Changelog was sent to Discord.");
    } else if (form.id === "branding-form") {
      const result = await api("/api/branding", {
        method: "PATCH",
        body: JSON.stringify(values)
      });
      applyBranding(result.branding);
      await refreshData();
      toast("Branding was saved.");
    } else if (form.id === "status-form") {
      await api("/api/statuses", {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          color: values.color,
          isDone: form.querySelector("[name='isDone']")?.checked === true
        })
      });
      await refreshData();
      toast("Status was added.");
    } else if (form.id === "token-form") {
      const result = await api("/api/tokens", {
        method: "POST",
        body: JSON.stringify({ name: values.name, scope: values.scope })
      });
      await refreshData();
      showTokenResult(result.token, result.record);
    }
  } catch (error) {
    toast(error.message, "error");
    if (submitButton) submitButton.disabled = false;
  }
});

modal.addEventListener("click", (event) => {
  if (event.target === modal && !state.loginPromptActive) closeModal();
});

modal.addEventListener("cancel", (event) => {
  if (state.loginPromptActive) event.preventDefault();
});

window.addEventListener("resize", () => {
  if (tutorial.active) renderTutorialStep();
});

document.addEventListener("keydown", (event) => {
  if (!tutorial.active) return;
  if (event.key === "ArrowRight" && tutorial.index < tutorial.steps.length - 1) {
    tutorial.index += 1;
    renderTutorialStep();
  }
  if (event.key === "ArrowLeft" && tutorial.index > 0) {
    tutorial.index -= 1;
    renderTutorialStep();
  }
});

initialize();
