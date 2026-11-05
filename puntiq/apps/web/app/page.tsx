"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ModuleId =
  | "dashboard"
  | "properties"
  | "wws"
  | "tenants"
  | "contracts"
  | "maintenance"
  | "documents"
  | "finance"
  | "profile"
  | "settings";
type Property = {
  id: number;
  name: string;
  address: string;
  type: string;
  status: string;
  points: number;
  rent: number;
  image?: string;
  area?: number;
  rooms?: number;
  bedrooms?: number;
  yearBuilt?: number;
  energyLabel?: string;
  floor?: string;
  price?: number;
  description?: string;
};
type Tenant = {
  id: number;
  name: string;
  property: string;
  email: string;
  phone: string;
  status: string;
};
type Contract = {
  id: number;
  property: string;
  tenant: string;
  start: string;
  end: string;
  rent: number;
  status: string;
};
type Maintenance = {
  id: number;
  property: string;
  title: string;
  priority: string;
  status: string;
  date: string;
};
type DocumentItem = {
  id: number;
  name: string;
  category: string;
  property: string;
  date: string;
  size: string;
};

const navItems: { id: ModuleId; icon: string; label: string }[] = [
  { id: "dashboard", icon: "⌂", label: "Overzicht" },
  { id: "properties", icon: "▦", label: "Vastgoed" },
  { id: "wws", icon: "◈", label: "WWS / WWSO" },
  { id: "tenants", icon: "♙", label: "Huurders" },
  { id: "contracts", icon: "▤", label: "Contracten" },
  { id: "maintenance", icon: "⚒", label: "Onderhoud" },
  { id: "documents", icon: "□", label: "Documenten" },
  { id: "finance", icon: "€", label: "Financieel" },
];
const propertiesSeed: Property[] = [
  {
    id: 1,
    name: "Prinsengracht 482",
    address: "1017 KH Amsterdam",
    type: "Zelfstandig",
    status: "Verhuurd",
    points: 178,
    rent: 1142.04,
  },
  {
    id: 2,
    name: "Willemsparkweg 94",
    address: "1071 HH Amsterdam",
    type: "Zelfstandig",
    status: "Beschikbaar",
    points: 142,
    rent: 912.37,
  },
  {
    id: 3,
    name: "Korte Nieuweweg 11A",
    address: "3512 NP Utrecht",
    type: "Onzelfstandig",
    status: "In onderhoud",
    points: 87,
    rent: 548.12,
  },
  {
    id: 4,
    name: "Singel 229",
    address: "1012 WE Amsterdam",
    type: "Zelfstandig",
    status: "Verhuurd",
    points: 198,
    rent: 1294.81,
  },
];
const tenantsSeed: Tenant[] = [
  {
    id: 1,
    name: "Sophie Jansen",
    property: "Prinsengracht 482",
    email: "sophie.jansen@email.nl",
    phone: "06 1234 5678",
    status: "Actief",
  },
  {
    id: 2,
    name: "Mark de Boer",
    property: "Singel 229",
    email: "mark.deboer@email.nl",
    phone: "06 2345 6789",
    status: "Actief",
  },
  {
    id: 3,
    name: "Nora Visser",
    property: "Willemsparkweg 94",
    email: "nora.visser@email.nl",
    phone: "06 3456 7890",
    status: "Nieuw",
  },
];
const contractsSeed: Contract[] = [
  {
    id: 1,
    property: "Prinsengracht 482",
    tenant: "Sophie Jansen",
    start: "01-05-2023",
    end: "30-04-2027",
    rent: 1142.04,
    status: "Actief",
  },
  {
    id: 2,
    property: "Singel 229",
    tenant: "Mark de Boer",
    start: "01-01-2024",
    end: "30-11-2026",
    rent: 1294.81,
    status: "Verloopt binnenkort",
  },
  {
    id: 3,
    property: "Willemsparkweg 94",
    tenant: "Nora Visser",
    start: "01-12-2026",
    end: "30-11-2027",
    rent: 912.37,
    status: "Concept",
  },
];
const maintenanceSeed: Maintenance[] = [
  {
    id: 1,
    property: "Prinsengracht 482",
    title: "Lekkage badkamer",
    priority: "Hoog",
    status: "Open",
    date: "Vandaag",
  },
  {
    id: 2,
    property: "Korte Nieuweweg 11A",
    title: "Schilderwerk trappenhuis",
    priority: "Gemiddeld",
    status: "In behandeling",
    date: "02 nov 2026",
  },
  {
    id: 3,
    property: "Singel 229",
    title: "CV-ketel inspectie",
    priority: "Laag",
    status: "Afgerond",
    date: "28 okt 2026",
  },
];
const documentsSeed: DocumentItem[] = [
  {
    id: 1,
    name: "Huurovereenkomst - Jansen.pdf",
    category: "Contracten",
    property: "Prinsengracht 482",
    date: "01 mei 2023",
    size: "2,4 MB",
  },
  {
    id: 2,
    name: "Energielabel Singel 229.pdf",
    category: "WWS / WWSO",
    property: "Singel 229",
    date: "12 okt 2026",
    size: "840 KB",
  },
  {
    id: 3,
    name: "Inspectierapport Korte Nieuweweg.pdf",
    category: "Onderhoud",
    property: "Korte Nieuweweg 11A",
    date: "02 nov 2026",
    size: "1,1 MB",
  },
];
const money = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(
    n,
  );
const descriptions: Record<ModuleId, string> = {
  dashboard: "",
  profile: "Beheer uw persoonlijke gegevens en profielfoto.",
  properties: "Beheer en organiseer uw volledige vastgoedportefeuille.",
  wws: "Bereken WWS/WWSO-punten en maximale huurprijzen.",
  tenants: "Houd uw huurders en contactgegevens overzichtelijk bij.",
  contracts: "Beheer huurcontracten, looptijden en verlengingen.",
  maintenance: "Volg meldingen, werkzaamheden en onderhoudskosten.",
  settings: "Beheer uw account, voorkeuren en werkruimte.",
  documents: "Alle contracten, rapporten en documenten op één plek.",
  finance: "Inzicht in huurinkomsten, kosten en financiële prestaties.",
};

export default function Home() {
  const router = useRouter();
  const [active, setActive] = useState<ModuleId>("dashboard");
  const [properties, setProperties] = useState(propertiesSeed);
  const [tenants, setTenants] = useState(tenantsSeed);
  const [contracts] = useState(contractsSeed);
  const [maintenance, setMaintenance] = useState(maintenanceSeed);
  const [documents, setDocuments] = useState(documentsSeed);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<
    "property" | "propertyDetail" | "tenant" | "maintenance" | "wws" | null
  >(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null,
  );
  const [toast, setToast] = useState("");
  const [darkMode] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("puntiq-theme") === "dark",
  );
  const [username, setUsername] = useState("admin");
  const [email, setEmail] = useState("admin@brinlore.nl");
  const [avatar, setAvatar] = useState("");
  const [profileMenu, setProfileMenu] = useState(false);
  useEffect(() => {
    fetch("/api/auth/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.user?.username) setUsername(data.user.username);
        if (data?.user?.email) setEmail(data.user.email);
        if (data?.user?.avatar) setAvatar(data.user.avatar);
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    localStorage.setItem("puntiq-theme", darkMode ? "dark" : "light");
  }, [darkMode]);
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };
  // Dit is bewust geen hook: de moduleweergave wordt conditioneel gerenderd.
  // Een hook in deze helper zou het aantal hooks veranderen bij navigatie.
  const filtered = <T,>(items: T[]) =>
    items.filter((item) =>
      JSON.stringify(item).toLowerCase().includes(query.toLowerCase()),
    );
  const title =
    active === "profile"
      ? "Profiel"
      : active === "settings"
        ? "Instellingen"
        : (navItems.find((item) => item.id === active)?.label ?? "Overzicht");
  const addProperty = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const d = new FormData(event.currentTarget);
    setProperties([
      {
        id: Date.now(),
        name: String(d.get("name")),
        address: String(d.get("address")),
        type: String(d.get("type")),
        status: "Beschikbaar",
        points: 0,
        rent: Number(d.get("rent")) || 0,
        image: String(d.get("image") || ""),
        area: Number(d.get("area")) || undefined,
        rooms: Number(d.get("rooms")) || undefined,
        bedrooms: Number(d.get("bedrooms")) || undefined,
        yearBuilt: Number(d.get("yearBuilt")) || undefined,
        energyLabel: String(d.get("energyLabel") || ""),
        floor: String(d.get("floor") || ""),
        price: Number(d.get("price")) || undefined,
        description: String(d.get("description") || ""),
      },
      ...properties,
    ]);
    setModal(null);
    notify("Nieuwe woning toegevoegd aan uw portefeuille");
  };
  const addTenant = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const d = new FormData(event.currentTarget);
    setTenants([
      {
        id: Date.now(),
        name: String(d.get("name")),
        property: String(d.get("property")),
        email: String(d.get("email")),
        phone: String(d.get("phone")),
        status: "Nieuw",
      },
      ...tenants,
    ]);
    setModal(null);
    notify("Huurder toegevoegd");
  };
  const addMaintenance = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const d = new FormData(event.currentTarget);
    setMaintenance([
      {
        id: Date.now(),
        property: String(d.get("property")),
        title: String(d.get("title")),
        priority: String(d.get("priority")),
        status: "Open",
        date: "Vandaag",
      },
      ...maintenance,
    ]);
    setModal(null);
    notify("Onderhoudsverzoek geregistreerd");
  };
  const cycleMaintenance = (id: number) => {
    setMaintenance((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              status: item.status === "Open" ? "In behandeling" : "Afgerond",
            }
          : item,
      ),
    );
    notify("Onderhoudsstatus bijgewerkt");
  };

  return (
    <main className={`app-shell ${darkMode ? "dark-mode" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">P</span>
          <span>
            BRINLORE <b>PUNTIQ</b>
          </span>
        </div>
        <div className="workspace">
          <span className="avatar tiny">V</span>
          <span>
            <small>WERKRUIMTE</small>
            <strong>Van Dijk Vastgoed</strong>
          </span>
          <span className="chevron">⌄</span>
        </div>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={active === item.id ? "nav-item active" : "nav-item"}
              onClick={() => {
                setActive(item.id);
                setQuery("");
              }}
            >
              <i>{item.icon}</i>
              {item.label}
              {item.id === "maintenance" && (
                <span className="nav-count">3</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="nav-item"
            onClick={() =>
              notify("Helpcentrum: stuur uw vraag naar support@brinlore.nl")
            }
          >
            ?<span>Helpcentrum</span>
          </button>
        </div>
      </aside>
      <section className="content">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Van Dijk Vastgoed</span>
            <b>/</b>
            <strong>{title}</strong>
          </div>
          <div className="top-actions">
            <button
              className="icon-btn"
              aria-label="Zoeken"
              onClick={() =>
                document
                  .querySelector<HTMLInputElement>(".global-search")
                  ?.focus()
              }
            >
              ⌕
            </button>
            <button
              className="icon-btn notification"
              aria-label="Meldingen"
              onClick={() => notify("U heeft 3 nieuwe meldingen")}
            >
              ♢<em />
            </button>
            <div className="profile-menu-wrap">
              <button
                className="top-avatar top-avatar-button"
                aria-label="Profielmenu"
                onClick={() => setProfileMenu((value) => !value)}
              >
                {avatar ? (
                  <img
                    className="avatar-image"
                    src={avatar}
                    alt="Profielfoto"
                  />
                ) : (
                  username.slice(0, 2).toUpperCase()
                )}
              </button>
              {profileMenu && (
                <div className="profile-menu">
                  <div className="profile-menu-head">
                    {avatar ? (
                      <img
                        className="avatar avatar-image"
                        src={avatar}
                        alt="Profielfoto"
                      />
                    ) : (
                      <span className="avatar">
                        {username.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <strong>{username}</strong>
                      <small>{email}</small>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setActive("profile");
                      setProfileMenu(false);
                    }}
                  >
                    Profiel
                  </button>
                  <button
                    onClick={() => {
                      setActive("settings");
                      setProfileMenu(false);
                    }}
                  >
                    Instellingen
                  </button>
                  <button className="menu-logout" onClick={logout}>
                    Uitloggen
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="page-body">
          {active === "dashboard" ? (
            <Dashboard
              properties={properties}
              maintenance={maintenance}
              onNavigate={setActive}
              onAdd={() => setModal("property")}
              onWws={() => setModal("wws")}
              onPropertyClick={(property) => {
                setSelectedProperty(property);
                setModal("propertyDetail");
              }}
            />
          ) : (
            <Module
              active={active}
              properties={filtered(properties)}
              tenants={filtered(tenants)}
              contracts={filtered(contracts)}
              maintenance={filtered(maintenance)}
              documents={filtered(documents)}
              query={query}
              setQuery={setQuery}
              onAddProperty={() => setModal("property")}
              onAddTenant={() => setModal("tenant")}
              onAddMaintenance={() => setModal("maintenance")}
              onWws={() => setModal("wws")}
              onCycleMaintenance={cycleMaintenance}
              onRemoveDocument={(id) => {
                setDocuments((items) => items.filter((item) => item.id !== id));
                notify("Document verwijderd");
              }}
              onNotify={notify}
              onPropertyClick={(property) => {
                setSelectedProperty(property);
                setModal("propertyDetail");
              }}
            />
          )}
        </div>
      </section>
      {modal === "property" && (
        <PropertyModal onClose={() => setModal(null)} onSubmit={addProperty} />
      )}
      {modal === "propertyDetail" && selectedProperty && (
        <PropertyDetail
          property={selectedProperty}
          onClose={() => {
            setModal(null);
            setSelectedProperty(null);
          }}
        />
      )}
      {modal === "tenant" && (
        <FormModal
          title="Nieuwe huurder toevoegen"
          eyebrow="HUURDERS"
          fields={[
            ["name", "Naam huurder", "bijv. Eva Jansen"],
            ["email", "E-mailadres", "eva@email.nl"],
            ["phone", "Telefoonnummer", "06 1234 5678"],
            ["property", "Object", "bijv. Prinsengracht 482"],
          ]}
          onClose={() => setModal(null)}
          onSubmit={addTenant}
        />
      )}
      {modal === "maintenance" && (
        <FormModal
          title="Onderhoudsverzoek melden"
          eyebrow="ONDERHOUD"
          fields={[
            ["title", "Omschrijving", "bijv. Lekkende kraan"],
            ["property", "Object", "bijv. Prinsengracht 482"],
          ]}
          select={{
            name: "priority",
            label: "Prioriteit",
            options: ["Hoog", "Gemiddeld", "Laag"],
          }}
          onClose={() => setModal(null)}
          onSubmit={addMaintenance}
        />
      )}
      {modal === "wws" && (
        <WwsModal
          onClose={() => setModal(null)}
          onSave={() => {
            setModal(null);
            notify("WWS-berekening opgeslagen");
          }}
        />
      )}
      {toast && <div className="toast">✓ {toast}</div>}
    </main>
  );
}

function Dashboard({
  properties,
  maintenance,
  onNavigate,
  onAdd,
  onWws,
  onPropertyClick,
}: {
  properties: Property[];
  maintenance: Maintenance[];
  onNavigate: (id: ModuleId) => void;
  onAdd: () => void;
  onWws: () => void;
  onPropertyClick: (property: Property) => void;
}) {
  const rent = properties.reduce((sum, p) => sum + p.rent, 0);
  return (
    <>
      <div className="welcome">
        <div>
          <p className="eyebrow">WOENSDAG 4 NOVEMBER 2026</p>
          <h1>
            Goedemorgen, Joris <span>✦</span>
          </h1>
          <p className="muted">
            Hier is wat er vandaag speelt binnen uw portefeuille.
          </p>
        </div>
        <button className="primary" onClick={onAdd}>
          ＋ Nieuwe woning
        </button>
      </div>
      <div className="stats-grid">
        <Stat
          label="Totaal objecten"
          value="128"
          trend="+6 deze maand"
          icon="⌂"
          color="blue"
        />
        <Stat
          label="Bezettingsgraad"
          value="94,2%"
          trend="+1,8% t.o.v. vorige maand"
          icon="◉"
          color="green"
        />
        <Stat
          label="Openstaande acties"
          value={String(
            maintenance.filter((x) => x.status !== "Afgerond").length + 9,
          )}
          trend="3 urgent"
          icon="!"
          color="orange"
        />
        <Stat
          label="Maandelijkse huur"
          value={money(rent || 184520)}
          trend="+4,6% deze maand"
          icon="€"
          color="purple"
        />
      </div>
      <div className="grid-main">
        <div className="panel overview-panel">
          <PanelHeading
            title="Portefeuille overzicht"
            subtitle="Verdeling van uw vastgoedobjecten"
            link="Bekijk alles →"
            onClick={() => onNavigate("properties")}
          />
          <div className="chart-wrap">
            <div className="donut">
              <div>
                <strong>128</strong>
                <span>objecten</span>
              </div>
            </div>
            <div className="legend">
              <Legend color="var(--blue)" label="Verhuurd" value="94" />
              <Legend color="var(--green)" label="Beschikbaar" value="18" />
              <Legend color="var(--orange)" label="In onderhoud" value="12" />
              <div className="legend-total">
                <span>Totale waarde</span>
                <strong>€ 42,8M</strong>
              </div>
            </div>
          </div>
        </div>
        <div className="panel actions-panel">
          <PanelHeading
            title="Actie vereist"
            subtitle="Uw belangrijkste taken"
          />
          <Action
            icon="⚒"
            color="orange"
            title="Onderhoudsverzoek"
            detail="Lekkage — Prinsengracht 482"
            time="Vandaag"
            onClick={() => onNavigate("maintenance")}
          />
          <Action
            icon="▤"
            color="purple"
            title="Contract verloopt"
            detail="Singel 229 — over 26 dagen"
            time="30 nov"
            onClick={() => onNavigate("contracts")}
          />
          <Action
            icon="◈"
            color="blue"
            title="Nieuwe WWS-berekening"
            detail="Willemsparkweg 94"
            time="Starten"
            onClick={onWws}
          />
        </div>
      </div>
      <div className="panel recent">
        <PanelHeading
          title="Recente objecten"
          subtitle="De laatst bijgewerkte objecten in uw portefeuille"
          link="Alle objecten →"
          onClick={() => onNavigate("properties")}
        />
        <PropertyTable
          properties={properties}
          onWws={onWws}
          onPropertyClick={onPropertyClick}
        />
      </div>
    </>
  );
}

function Module({
  active,
  properties,
  tenants,
  contracts,
  maintenance,
  documents,
  query,
  setQuery,
  onAddProperty,
  onAddTenant,
  onAddMaintenance,
  onWws,
  onCycleMaintenance,
  onRemoveDocument,
  onNotify,
  onPropertyClick,
}: {
  active: ModuleId;
  properties: Property[];
  tenants: Tenant[];
  contracts: Contract[];
  maintenance: Maintenance[];
  documents: DocumentItem[];
  query: string;
  setQuery: (q: string) => void;
  onAddProperty: () => void;
  onAddTenant: () => void;
  onAddMaintenance: () => void;
  onWws: () => void;
  onCycleMaintenance: (id: number) => void;
  onRemoveDocument: (id: number) => void;
  onNotify: (msg: string) => void;
  onPropertyClick: (property: Property) => void;
}) {
  if (active === "profile") return <ProfilePanel />;
  if (active === "settings") return <SettingsPanel />;
  const item = navItems.find((x) => x.id === active)!;
  const add =
    active === "properties"
      ? onAddProperty
      : active === "tenants"
        ? onAddTenant
        : active === "maintenance"
          ? onAddMaintenance
          : undefined;
  return (
    <>
      <div className="welcome">
        <div>
          <p className="eyebrow">MODULE</p>
          <h1>{item.label}</h1>
          <p className="muted">{descriptions[active]}</p>
        </div>
        {add && (
          <button className="primary" onClick={add}>
            ＋{" "}
            {active === "properties"
              ? "Nieuwe woning"
              : active === "tenants"
                ? "Nieuwe huurder"
                : "Verzoek melden"}
          </button>
        )}
      </div>
      {active === "wws" ? (
        <WwsOverview onWws={onWws} />
      ) : active === "finance" ? (
        <Finance onNotify={onNotify} />
      ) : (
        <div className="panel recent">
          <div className="table-tools">
            <div className="search">
              ⌕
              <input
                className="global-search"
                placeholder="Zoek in deze module..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button
              className="secondary"
              onClick={() =>
                onNotify(
                  "Filteropties zijn beschikbaar zodra gegevens gekoppeld zijn",
                )
              }
            >
              Filteren ↕
            </button>
          </div>
          {active === "properties" && (
            <PropertyTable
              properties={properties}
              onWws={onWws}
              onPropertyClick={onPropertyClick}
            />
          )}
          {active === "tenants" && <TenantTable tenants={tenants} />}
          {active === "contracts" && <ContractTable contracts={contracts} />}
          {active === "maintenance" && (
            <MaintenanceTable
              items={maintenance}
              onCycle={onCycleMaintenance}
            />
          )}
          {active === "documents" && (
            <DocumentTable documents={documents} onRemove={onRemoveDocument} />
          )}
        </div>
      )}
    </>
  );
}
// Kept for backward-compatible hot reloads while existing sessions refresh.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacySettingsPanel() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("puntiq-theme") === "dark",
  );
  const [username, setUsername] = useState("admin");
  const [email, setEmail] = useState("admin@brinlore.nl");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    document.documentElement.classList.toggle("dark-mode", darkMode);
  }, [darkMode]);
  useEffect(() => {
    fetch("/api/auth/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user?.username) setUsername(data.user.username);
        if (data?.user?.email) setEmail(data.user.email);
      })
      .catch(() => undefined);
  }, []);
  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("puntiq-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark-mode", next);
  };
  const saveAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await fetch("/api/auth/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await response.json();
    setMessage(
      response.ok
        ? "Accountgegevens opgeslagen."
        : (data.error ?? "Opslaan mislukt."),
    );
    if (response.ok) setPassword("");
  };
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };
  return (
    <>
      <div className="welcome">
        <div>
          <p className="eyebrow">ACCOUNT & VOORKEUREN</p>
          <h1>Instellingen</h1>
          <p className="muted">Pas uw ervaring en account veilig aan.</p>
        </div>
        <button className="secondary" onClick={logout}>
          ↪ Uitloggen
        </button>
      </div>
      <div className="settings-grid">
        <section className="panel settings-card">
          <div className="settings-icon blue">⚙</div>
          <div>
            <h2>Accountgegevens</h2>
            <p className="muted">
              Werk uw gebruikersnaam, e-mail of wachtwoord bij.
            </p>
          </div>
          <form className="settings-form" onSubmit={saveAccount}>
            <label>
              Gebruikersnaam
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </label>
            <label>
              E-mailadres
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="text"
                required
              />
            </label>
            <label>
              Nieuw wachtwoord <span>(optioneel)</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                minLength={8}
                placeholder="Minimaal 8 tekens"
              />
            </label>
            {message && <p className="settings-message">{message}</p>}
            <button className="primary">Wijzigingen opslaan</button>
          </form>
        </section>
        <section className="panel settings-card">
          <div className="settings-icon purple">☾</div>
          <div>
            <h2>Weergave</h2>
            <p className="muted">Kies de weergave die prettig werkt.</p>
          </div>
          <div className="setting-row">
            <div>
              <strong>Donkere modus</strong>
              <small>Minder fel licht tijdens avondwerk.</small>
            </div>
            <button
              type="button"
              className={`toggle ${darkMode ? "on" : ""}`}
              aria-label="Donkere modus"
              onClick={toggleTheme}
            >
              <span />
            </button>
          </div>
          <div className="setting-row">
            <div>
              <strong>Compacte meldingen</strong>
              <small>Toon alleen urgente acties.</small>
            </div>
            <span className="setting-status">Actief</span>
          </div>
        </section>
        <section className="panel settings-card">
          <div className="settings-icon green">✓</div>
          <div>
            <h2>Beveiliging</h2>
            <p className="muted">
              Uw sessie is beveiligd met een httpOnly cookie.
            </p>
          </div>
          <div className="security-line">
            <span className="security-dot" /> Account actief{" "}
            <strong>8 uur sessieduur</strong>
          </div>
          <button className="danger-button" onClick={logout}>
            Overal uitloggen
          </button>
        </section>
      </div>
    </>
  );
}
function ProfilePanel() {
  const [username, setUsername] = useState("admin");
  const [email, setEmail] = useState("admin@brinlore.nl");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    fetch("/api/auth/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.user) {
          setUsername(data.user.username ?? "");
          setEmail(data.user.email ?? "");
          setAvatar(data.user.avatar ?? "");
        }
      })
      .catch(() => undefined);
  }, []);
  const chooseAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      setMessage("Kies een afbeelding van maximaal 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.readAsDataURL(file);
  };
  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await fetch("/api/auth/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password, avatar }),
    });
    const data = await response.json();
    setMessage(
      response.ok ? "Profiel opgeslagen." : (data.error ?? "Opslaan mislukt."),
    );
    if (response.ok) {
      setPassword("");
      window.location.reload();
    }
  };
  return (
    <>
      <div className="welcome">
        <div>
          <p className="eyebrow">MIJN ACCOUNT</p>
          <h1>Profiel</h1>
          <p className="muted">
            Beheer uw persoonlijke gegevens en profielfoto.
          </p>
        </div>
      </div>
      <div className="profile-layout">
        <section className="panel profile-photo-card">
          <div className="profile-photo-wrap">
            {avatar ? (
              <img className="profile-photo" src={avatar} alt="Profielfoto" />
            ) : (
              <div className="profile-photo profile-photo-fallback">
                {username.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <h2>{username}</h2>
          <p className="muted">Uw PUNTIQ-account</p>
          <label className="secondary profile-file">
            Profielfoto kiezen
            <input type="file" accept="image/*" onChange={chooseAvatar} />
          </label>
          <small className="muted">JPG, PNG of WEBP · maximaal 2 MB</small>
        </section>
        <section className="panel settings-card">
          <div className="settings-icon blue">✎</div>
          <div>
            <h2>Persoonlijke gegevens</h2>
            <p className="muted">Wijzig uw gegevens en wachtwoord.</p>
          </div>
          <form className="settings-form" onSubmit={saveProfile}>
            <label>
              Gebruikersnaam
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </label>
            <label>
              E-mailadres
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Nieuw wachtwoord <span>(optioneel, minimaal 8 tekens)</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                minLength={8}
                placeholder="Laat leeg om te behouden"
              />
            </label>
            {message && <p className="settings-message">{message}</p>}
            <button className="primary">Profiel opslaan</button>
          </form>
        </section>
      </div>
    </>
  );
}

function SettingsPanel() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("puntiq-theme") === "dark",
  );
  const [compact, setCompact] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("puntiq-compact") === "true",
  );
  const [emailNotifications, setEmailNotifications] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("puntiq-email-notifications") !== "false",
  );
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("puntiq-reduced-motion") === "true",
  );
  const [message, setMessage] = useState("");
  useEffect(() => {
    document.documentElement.classList.toggle("dark-mode", darkMode);
    localStorage.setItem("puntiq-theme", darkMode ? "dark" : "light");
  }, [darkMode]);
  useEffect(() => {
    localStorage.setItem("puntiq-compact", String(compact));
  }, [compact]);
  useEffect(() => {
    localStorage.setItem(
      "puntiq-email-notifications",
      String(emailNotifications),
    );
  }, [emailNotifications]);
  useEffect(() => {
    document.documentElement.classList.toggle("reduced-motion", reducedMotion);
    localStorage.setItem("puntiq-reduced-motion", String(reducedMotion));
  }, [reducedMotion]);
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };
  const reset = () => {
    setDarkMode(false);
    setCompact(false);
    setEmailNotifications(true);
    setReducedMotion(false);
    setMessage("Voorkeuren zijn hersteld.");
  };
  return (
    <>
      <div className="welcome">
        <div>
          <p className="eyebrow">VOORKEUREN</p>
          <h1>Instellingen</h1>
          <p className="muted">Pas PUNTIQ aan op uw manier van werken.</p>
        </div>
        <button className="secondary" onClick={logout}>
          Uitloggen
        </button>
      </div>
      <div className="settings-grid">
        <section className="panel settings-card">
          <div className="settings-icon purple">☾</div>
          <div>
            <h2>Weergave</h2>
            <p className="muted">Maak de interface comfortabeler.</p>
          </div>
          <div className="setting-row">
            <div>
              <strong>Donkere modus</strong>
              <small>Minder fel licht tijdens avondwerk.</small>
            </div>
            <button
              type="button"
              className={`toggle ${darkMode ? "on" : ""}`}
              aria-label="Donkere modus"
              onClick={() => setDarkMode(!darkMode)}
            >
              <span />
            </button>
          </div>
          <div className="setting-row">
            <div>
              <strong>Minder beweging</strong>
              <small>Beperk animaties en overgangen.</small>
            </div>
            <button
              type="button"
              className={`toggle ${reducedMotion ? "on" : ""}`}
              aria-label="Minder beweging"
              onClick={() => setReducedMotion(!reducedMotion)}
            >
              <span />
            </button>
          </div>
        </section>
        <section className="panel settings-card">
          <div className="settings-icon blue">♢</div>
          <div>
            <h2>Meldingen</h2>
            <p className="muted">Bepaal welke meldingen u ziet.</p>
          </div>
          <div className="setting-row">
            <div>
              <strong>Compacte meldingen</strong>
              <small>Toon alleen urgente acties in compacte vorm.</small>
            </div>
            <button
              type="button"
              className={`toggle ${compact ? "on" : ""}`}
              aria-label="Compacte meldingen"
              onClick={() => setCompact(!compact)}
            >
              <span />
            </button>
          </div>
          <div className="setting-row">
            <div>
              <strong>E-mailmeldingen</strong>
              <small>Ontvang updates over onderhoud en contracten.</small>
            </div>
            <button
              type="button"
              className={`toggle ${emailNotifications ? "on" : ""}`}
              aria-label="E-mailmeldingen"
              onClick={() => setEmailNotifications(!emailNotifications)}
            >
              <span />
            </button>
          </div>
        </section>
        <section className="panel settings-card">
          <div className="settings-icon green">✓</div>
          <div>
            <h2>Sessie & privacy</h2>
            <p className="muted">Beheer uw actieve sessie.</p>
          </div>
          <div className="security-line">
            <span className="security-dot" /> Account actief{" "}
            <strong>Automatisch opgeslagen op dit apparaat</strong>
          </div>
          <button className="secondary" onClick={reset}>
            Voorkeuren herstellen
          </button>
          <button className="danger-button" onClick={logout}>
            Overal uitloggen
          </button>
          {message && <p className="settings-message">{message}</p>}
        </section>
      </div>
    </>
  );
}

function PanelHeading({
  title,
  subtitle,
  link,
  onClick,
}: {
  title: string;
  subtitle: string;
  link?: string;
  onClick?: () => void;
}) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {link && (
        <button className="link-button" onClick={onClick}>
          {link}
        </button>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  trend,
  icon,
  color,
}: {
  label: string;
  value: string;
  trend: string;
  icon: string;
  color: string;
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small className={trend.includes("urgent") ? "urgent" : ""}>
          {trend}
        </small>
      </div>
    </div>
  );
}
function Legend({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="legend-row">
      <i style={{ background: color }} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Action({
  icon,
  color,
  title,
  detail,
  time,
  onClick,
}: {
  icon: string;
  color: string;
  title: string;
  detail: string;
  time: string;
  onClick: () => void;
}) {
  return (
    <button className="action" onClick={onClick}>
      <span className={`action-icon ${color}`}>{icon}</span>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      <time>{time}</time>
    </button>
  );
}
function PropertyTable({
  properties,
  onWws,
  onPropertyClick,
}: {
  properties: Property[];
  onWws: () => void;
  onPropertyClick: (property: Property) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>OBJECT</th>
            <th>TYPE</th>
            <th>STATUS</th>
            <th>WWS-PUNTEN</th>
            <th>MAX. HUURPRIJS</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {properties.map((p) => (
            <tr
              key={p.id}
              className="property-row"
              onClick={() => onPropertyClick(p)}
            >
              <td>
                <strong>{p.name}</strong>
                <span>{p.address}</span>
              </td>
              <td>{p.type}</td>
              <td>
                <span
                  className={`status ${p.status.replaceAll(" ", "-").toLowerCase()}`}
                >
                  {p.status}
                </span>
              </td>
              <td>
                <button
                  className="points"
                  onClick={(event) => {
                    event.stopPropagation();
                    onWws();
                  }}
                >
                  {p.points || "—"} {p.points > 0 && "pt"}
                </button>
              </td>
              <td>
                <strong>{p.rent ? money(p.rent) : "—"}</strong>
              </td>
              <td>
                <button
                  className="row-menu"
                  onClick={(event) => {
                    event.stopPropagation();
                    onPropertyClick(p);
                  }}
                >
                  •••
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function TenantTable({ tenants }: { tenants: Tenant[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>HUURDER</th>
            <th>OBJECT</th>
            <th>CONTACT</th>
            <th>TELEFOON</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((t) => (
            <tr key={t.id}>
              <td>
                <strong>{t.name}</strong>
              </td>
              <td>{t.property}</td>
              <td>{t.email}</td>
              <td>{t.phone}</td>
              <td>
                <span className={`status ${t.status.toLowerCase()}`}>
                  {t.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function ContractTable({ contracts }: { contracts: Contract[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>OBJECT</th>
            <th>HUURDER</th>
            <th>START</th>
            <th>EINDDATUM</th>
            <th>HUUR</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((c) => (
            <tr key={c.id}>
              <td>
                <strong>{c.property}</strong>
              </td>
              <td>{c.tenant}</td>
              <td>{c.start}</td>
              <td>{c.end}</td>
              <td>
                <strong>{money(c.rent)}</strong>
              </td>
              <td>
                <span
                  className={`status ${c.status.replaceAll(" ", "-").toLowerCase()}`}
                >
                  {c.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function MaintenanceTable({
  items,
  onCycle,
}: {
  items: Maintenance[];
  onCycle: (id: number) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>VERZOEK</th>
            <th>OBJECT</th>
            <th>PRIORITEIT</th>
            <th>DATUM</th>
            <th>STATUS</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.id}>
              <td>
                <strong>{m.title}</strong>
              </td>
              <td>{m.property}</td>
              <td>
                <span className={`status ${m.priority.toLowerCase()}`}>
                  {m.priority}
                </span>
              </td>
              <td>{m.date}</td>
              <td>
                <button
                  className="status action-status"
                  onClick={() => onCycle(m.id)}
                >
                  {m.status} ↻
                </button>
              </td>
              <td>
                <button className="row-menu">•••</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function DocumentTable({
  documents,
  onRemove,
}: {
  documents: DocumentItem[];
  onRemove: (id: number) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>DOCUMENT</th>
            <th>CATEGORIE</th>
            <th>OBJECT</th>
            <th>DATUM</th>
            <th>GROOTTE</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => (
            <tr key={d.id}>
              <td>
                <strong>▧ {d.name}</strong>
              </td>
              <td>{d.category}</td>
              <td>{d.property}</td>
              <td>{d.date}</td>
              <td>{d.size}</td>
              <td>
                <button className="row-menu" onClick={() => onRemove(d.id)}>
                  Verwijder
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function WwsOverview({ onWws }: { onWws: () => void }) {
  return (
    <>
      <div className="module-banner">
        <span className="banner-icon">◈</span>
        <div>
          <h2>WWS / WWSO rekenmodule</h2>
          <p>
            Maak een indicatieve puntentelling en bekijk direct de maximale kale
            huurprijs.
          </p>
        </div>
        <button className="primary light-button" onClick={onWws}>
          Nieuwe berekening
        </button>
      </div>
      <div className="stats-grid">
        <Stat
          label="Berekeningen dit jaar"
          value="46"
          trend="+12% t.o.v. vorig jaar"
          icon="◈"
          color="blue"
        />
        <Stat
          label="Gemiddeld aantal punten"
          value="156"
          trend="Over uw portefeuille"
          icon="◎"
          color="green"
        />
        <Stat
          label="Te controleren"
          value="8"
          trend="Energielabel ontbreekt"
          icon="!"
          color="orange"
        />
        <Stat
          label="Laatste update"
          value="Vandaag"
          trend="Regelgeving actueel"
          icon="✓"
          color="purple"
        />
      </div>
    </>
  );
}
function Finance({ onNotify }: { onNotify: (msg: string) => void }) {
  return (
    <>
      <div className="finance-grid">
        <div className="panel finance-card">
          <span>Huurinkomsten deze maand</span>
          <strong>€ 184.520</strong>
          <small className="positive">↑ 4,6% versus vorige maand</small>
        </div>
        <div className="panel finance-card">
          <span>Openstaande betalingen</span>
          <strong>€ 8.240</strong>
          <small className="urgent-text">3 betalingen vereisen aandacht</small>
        </div>
        <div className="panel finance-card">
          <span>Onderhoudskosten</span>
          <strong>€ 12.680</strong>
          <small>Deze maand</small>
        </div>
      </div>
      <div className="panel finance-report">
        <PanelHeading
          title="Financieel overzicht"
          subtitle="Inkomsten en uitgaven over de afgelopen 6 maanden"
        />
        <div className="bar-chart">
          {["mei", "jun", "jul", "aug", "sep", "okt"].map((month, index) => (
            <div className="bar-column" key={month}>
              <div className="bar" style={{ height: `${45 + index * 8}%` }} />
              <span>{month}</span>
            </div>
          ))}
        </div>
        <button
          className="secondary"
          onClick={() => onNotify("Financieel rapport wordt voorbereid")}
        >
          Exporteer rapport
        </button>
      </div>
    </>
  );
}
function PropertyModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [image, setImage] = useState("");
  const chooseImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 4 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal property-modal"
        onSubmit={onSubmit}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">VASTGOEDBEHEER</p>
            <h2>Nieuwe woning</h2>
            <p className="muted">Voer alle belangrijke woninginformatie in.</p>
          </div>
          <button type="button" className="close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="property-form-layout">
          <div className="property-upload">
            <div className="property-upload-preview">
              {image ? (
                <img src={image} alt="Voorbeeld woning" />
              ) : (
                <span>⌂</span>
              )}
            </div>
            <label className="secondary upload-button">
              Foto toevoegen
              <input type="file" accept="image/*" onChange={chooseImage} />
            </label>
            <small>JPG, PNG of WEBP · max. 4 MB</small>
            <input type="hidden" name="image" value={image} />
          </div>
          <div className="property-fields">
            <div className="form-grid">
              <label>
                Naam woning
                <input
                  name="name"
                  placeholder="bijv. Keizersgracht 12"
                  required
                />
              </label>
              <label>
                Adres / postcode
                <input
                  name="address"
                  placeholder="1015 AA Amsterdam"
                  required
                />
              </label>
              <label>
                Vierkante meters
                <input
                  name="area"
                  type="number"
                  min="1"
                  placeholder="bijv. 78"
                  required
                />
              </label>
              <label>
                Aantal kamers
                <input
                  name="rooms"
                  type="number"
                  min="1"
                  placeholder="bijv. 3"
                  required
                />
              </label>
              <label>
                Slaapkamers
                <input
                  name="bedrooms"
                  type="number"
                  min="0"
                  placeholder="bijv. 2"
                />
              </label>
              <label>
                Bouwjaar
                <input
                  name="yearBuilt"
                  type="number"
                  min="1800"
                  max="2100"
                  placeholder="bijv. 1924"
                />
              </label>
              <label>
                Woonlaag
                <input name="floor" placeholder="bijv. 2e verdieping" />
              </label>
              <label>
                Energielabel
                <select name="energyLabel">
                  <option value="">Onbekend</option>
                  {["A++", "A+", "A", "B", "C", "D", "E", "F", "G"].map(
                    (value) => (
                      <option key={value}>{value}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Type woning
                <select name="type">
                  <option>Zelfstandig</option>
                  <option>Onzelfstandig</option>
                  <option>Bedrijfsruimte</option>
                </select>
              </label>
              <label>
                Huurprijs per maand (€)
                <input
                  name="rent"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="bijv. 1250"
                  required
                />
              </label>
              <label className="wide-field">
                Vraagprijs (€)
                <input
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="bijv. 385000"
                />
              </label>
            </div>
            <label className="description-field">
              Beschrijving
              <textarea
                name="description"
                rows={3}
                placeholder="Beschrijf bijzonderheden, voorzieningen en andere informatie over de woning..."
              />
            </label>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Annuleren
          </button>
          <button className="primary">Woning toevoegen</button>
        </div>
      </form>
    </div>
  );
}

function PropertyDetail({
  property,
  onClose,
}: {
  property: Property;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal property-detail-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">WONINGDETAILS</p>
            <h2>{property.name}</h2>
            <p className="muted">{property.address}</p>
          </div>
          <button type="button" className="close" onClick={onClose}>
            ×
          </button>
        </div>
        {property.image && (
          <img
            className="property-detail-image"
            src={property.image}
            alt={property.name}
          />
        )}
        <div className="property-detail-grid">
          <div>
            <small>Type</small>
            <strong>{property.type}</strong>
          </div>
          <div>
            <small>Status</small>
            <strong>{property.status}</strong>
          </div>
          <div>
            <small>Oppervlakte</small>
            <strong>
              {property.area ? `${property.area} m²` : "Niet ingevuld"}
            </strong>
          </div>
          <div>
            <small>Kamers</small>
            <strong>{property.rooms ?? "Niet ingevuld"}</strong>
          </div>
          <div>
            <small>Slaapkamers</small>
            <strong>{property.bedrooms ?? "Niet ingevuld"}</strong>
          </div>
          <div>
            <small>Bouwjaar</small>
            <strong>{property.yearBuilt ?? "Niet ingevuld"}</strong>
          </div>
          <div>
            <small>Woonlaag</small>
            <strong>{property.floor || "Niet ingevuld"}</strong>
          </div>
          <div>
            <small>Energielabel</small>
            <strong>{property.energyLabel || "Onbekend"}</strong>
          </div>
          <div>
            <small>Huurprijs</small>
            <strong>
              {property.rent ? money(property.rent) : "Niet ingevuld"}
            </strong>
          </div>
          <div>
            <small>Vraagprijs</small>
            <strong>
              {property.price ? money(property.price) : "Niet ingevuld"}
            </strong>
          </div>
        </div>
        {property.description && (
          <div className="property-description">
            <small>Beschrijving</small>
            <p>{property.description}</p>
          </div>
        )}
        <div className="modal-actions">
          <button className="primary" onClick={onClose}>
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}

function FormModal({
  title,
  eyebrow,
  fields,
  select,
  onClose,
  onSubmit,
}: {
  title: string;
  eyebrow: string;
  fields: string[][];
  select?: { name: string; label: string; options: string[] };
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal"
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
          </div>
          <button type="button" className="close" onClick={onClose}>
            ×
          </button>
        </div>
        {fields.map(([name, label, placeholder]) => (
          <label key={name}>
            {label}
            <input name={name} placeholder={placeholder} required />
          </label>
        ))}
        {select && (
          <label>
            {select.label}
            <select name={select.name}>
              {select.options.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Annuleren
          </button>
          <button className="primary">Opslaan</button>
        </div>
      </form>
    </div>
  );
}
function WwsModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: () => void;
}) {
  const [area, setArea] = useState(62);
  const [energy, setEnergy] = useState("A");
  const [rooms, setRooms] = useState(3);
  const points = Math.round(
    area * 0.9 +
      (energy === "A" ? 30 : energy === "B" ? 24 : 15) +
      rooms * 4 +
      12,
  );
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">WWS / WWSO</p>
            <h2>Woningwaardering berekenen</h2>
          </div>
          <button className="close" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="muted">
          Vul de basisgegevens in voor een indicatieve berekening.
        </p>
        <div className="form-grid">
          <label>
            Oppervlakte (m²)
            <input
              type="number"
              min="1"
              value={area}
              onChange={(e) => setArea(Number(e.target.value))}
            />
          </label>
          <label>
            Energielabel
            <select value={energy} onChange={(e) => setEnergy(e.target.value)}>
              {["A++", "A+", "A", "B", "C", "D", "E", "F", "G"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Aantal kamers
            <input
              type="number"
              min="1"
              value={rooms}
              onChange={(e) => setRooms(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="result-box">
          <span>Indicatief resultaat</span>
          <strong>
            {points} <small>punten</small>
          </strong>
          <p>
            Maximale kale huurprijs <b>{money(points * 6.42 + 138)}</b>
          </p>
        </div>
        <div className="modal-actions">
          <button className="secondary" onClick={onClose}>
            Annuleren
          </button>
          <button className="primary" onClick={onSave}>
            Berekening opslaan
          </button>
        </div>
      </div>
    </div>
  );
}
