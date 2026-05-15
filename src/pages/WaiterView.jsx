import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, updateDoc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

const menu = [
  { category: "Starters", name: "Soup of the Day", description: "Chef's daily selection served with bread", price: 65 },
  { category: "Starters", name: "Calamari", description: "Crispy fried calamari with garlic aioli", price: 95 },
  { category: "Starters", name: "Bruschetta", description: "Toasted ciabatta with tomato, basil & olive oil", price: 85 },
  { category: "Starters", name: "Garden Salad", description: "Mixed greens with balsamic dressing", price: 45 },

  {
    category: "Mains",
    name: "Classic Burger",
    description: "Beef burger with chips",
    price: 95,
    modifiers: {
      doneness: ["Rare", "Medium Rare", "Medium", "Medium Well", "Well Done"],
      pickles: ["Yes", "No"],
      lettuce: ["Yes", "No"],
      mayo: ["Yes", "No"],
      tomato: ["Yes", "No"],
      side: ["Chips", "Salad"],
    },
  },
  {
    category: "Mains",
    name: "Cheese Burger",
    description: "Beef burger with cheddar and chips",
    price: 105,
    modifiers: {
      doneness: ["Rare", "Medium Rare", "Medium", "Medium Well", "Well Done"],
      pickles: ["Yes", "No"],
      lettuce: ["Yes", "No"],
      mayo: ["Yes", "No"],
      tomato: ["Yes", "No"],
      side: ["Chips", "Salad"],
    },
  },
  {
    category: "Mains",
    name: "Chicken Wrap",
    description: "Grilled chicken wrap with fries",
    price: 85,
    modifiers: {
      sauce: ["Mayo", "Peri Peri", "BBQ"],
      side: ["Chips", "Salad"],
    },
  },
  {
    category: "Mains",
    name: "Grilled Salmon",
    description: "Served with lemon butter vegetables",
    price: 225,
    modifiers: {
      cook: ["Medium", "Well Done"],
      side: ["Vegetables", "Rice"],
    },
  },
  {
    category: "Mains",
    name: "Lamb Shank",
    description: "Slow braised lamb shank",
    price: 245,
    modifiers: {
      side: ["Vegetables", "Rice", "Creamed Spinach"],
    },
  },
  {
    category: "Mains",
    name: "Ribeye Steak",
    description: "300g ribeye with a choice of side",
    price: 189,
    modifiers: {
      doneness: ["Rare", "Medium Rare", "Medium", "Medium Well", "Well Done"],
      basting: ["Yes", "No"],
      side: ["Chips", "Creamed Spinach", "Rice"],
    },
  },
  {
    category: "Mains",
    name: "Hake and Chips",
    description: "Golden fried hake with chips",
    price: 135,
    modifiers: {
      cook: ["Grilled", "Fried"],
      side: ["Chips", "Rice", "Creamed Spinach"],
    },
  },

  { category: "Sides", name: "Chips", description: "Crispy hand-cut chips", price: 40 },
  { category: "Sides", name: "Creamed Spinach", description: "Classic creamed spinach", price: 45 },
  { category: "Sides", name: "Rice", description: "Steamed rice", price: 30 },

  { category: "Desserts", name: "Ice Cream", description: "Vanilla ice cream", price: 38 },
  { category: "Desserts", name: "Malva Pudding", description: "Warm malva pudding with custard", price: 52 },
  { category: "Desserts", name: "Chocolate Brownie", description: "Rich brownie with chocolate sauce", price: 58 },
  { category: "Desserts", name: "Cheesecake", description: "Baked cheesecake", price: 60 },

  { category: "Drinks", name: "Still Water", description: "500ml bottled water", price: 22 },
  { category: "Drinks", name: "Sparkling Water", description: "500ml bottled sparkling water", price: 25 },
  { category: "Drinks", name: "Coke", description: "330ml", price: 25 },
  { category: "Drinks", name: "Coke Zero", description: "330ml", price: 25 },
  { category: "Drinks", name: "Fanta Orange", description: "330ml", price: 25 },
  { category: "Drinks", name: "Sprite", description: "330ml", price: 25 },
  { category: "Drinks", name: "Iced Tea", description: "Peach or lemon", price: 32 },
  { category: "Drinks", name: "Coffee", description: "Filter coffee", price: 28 },
  { category: "Drinks", name: "Cappuccino", description: "Single cappuccino", price: 34 },
  { category: "Drinks", name: "Tea", description: "Five Roses / Rooibos", price: 22 },
  { category: "Drinks", name: "Beer", description: "Local beer", price: 40 },
  { category: "Drinks", name: "Glass of Wine", description: "Red or white", price: 55 },

  { category: "Specials", name: "Chef's Pasta", description: "Daily special pasta", price: 145 },
  {
    category: "Specials",
    name: "Seafood Platter",
    description: "Calamari, hake and prawns",
    price: 295,
    modifiers: {
      hakeCook: ["Grilled", "Fried"],
      side: ["Chips", "Rice", "Creamed Spinach"],
    },
  },
];

const TABLE_IDS = ["1", "2", "3", "4", "5", "6", "7"];

function formatMoney(value) {
  return `R${Number(value || 0).toFixed(2)}`;
}

function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

function buildDisplayName(tab) {
  if (Array.isArray(tab.members) && tab.members.length > 0) {
    return tab.members.join(" & ");
  }
  return tab.name || "Unnamed Tab";
}

function formatModifierLabel(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}

function getBaseItemName(name) {
  return String(name || "").replace(" (Split)", "");
}

function getMenuItemByName(name) {
  return menu.find((item) => item.name === getBaseItemName(name)) || null;
}

function formatItemModifiers(item) {
  const modifiers = item?.modifiers || {};
  const menuItem = getMenuItemByName(item?.name);
  const orderedKeys = Object.keys(menuItem?.modifiers || {});
  const fallbackKeys = Object.keys(modifiers);
  const keys = orderedKeys.length > 0 ? orderedKeys : fallbackKeys;

  return keys
    .filter((key) => modifiers[key])
    .map((key) => `${formatModifierLabel(key)}: ${modifiers[key]}`)
    .join(" · ");
}

function getJoinLink(tableId) {
  if (typeof window === "undefined") return `/?table=${tableId}`;
  return `${window.location.origin}/?table=${tableId}`;
}

async function ensureTableDocument(tableId) {
  const ref = doc(db, "tables", tableId);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    await setDoc(ref, {
      guests: [],
      waiterName: "",
      tableStatus: "open",
    });
  }
}

export default function WaiterView() {
  const [tablesById, setTablesById] = useState({});
  const [selectedTableId, setSelectedTableId] = useState(null);

  const [waiterNameInput, setWaiterNameInput] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [newTabName, setNewTabName] = useState("");
  const [selectedTabId, setSelectedTabId] = useState(null);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);
  const [assignSelections, setAssignSelections] = useState([]);
  const [modifierSelections, setModifierSelections] = useState({});

  const [mainTabOpen, setMainTabOpen] = useState(false);

  useEffect(() => {
    TABLE_IDS.forEach((tableId) => {
      ensureTableDocument(tableId);
    });

    const unsubscribes = TABLE_IDS.map((tableId) => {
      const ref = doc(db, "tables", tableId);

      return onSnapshot(ref, (snapshot) => {
        const data = snapshot.data() || {
          guests: [],
          waiterName: "",
          tableStatus: "open",
        };

        setTablesById((prev) => ({
          ...prev,
          [tableId]: {
            guests: data.guests || [],
            waiterName: data.waiterName || "",
            tableStatus: data.tableStatus || "open",
          },
        }));
      });
    });

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  const table = selectedTableId
    ? tablesById[selectedTableId] || { guests: [], waiterName: "", tableStatus: "open" }
    : null;

  const tabs = table?.guests || [];
  const selectedTab = tabs.find((tab) => tab.id === selectedTabId) || null;

  const categories = useMemo(() => {
    const unique = [...new Set(menu.map((item) => item.category))];
    return ["All", ...unique];
  }, []);

  const filteredMenu = useMemo(() => {
    if (activeCategory === "All") return menu;
    return menu.filter((item) => item.category === activeCategory);
  }, [activeCategory]);

  const getTabSubtotal = (tab) => {
    return (tab?.items || []).reduce((sum, item) => sum + Number(item.price || 0), 0);
  };

  const getTabTip = (tab) => {
    const subtotal = getTabSubtotal(tab);
    const tipPercent = Number(tab?.tipPercent || 0);
    return subtotal * (tipPercent / 100);
  };

  const getTabTotalInclTip = (tab) => getTabSubtotal(tab) + getTabTip(tab);

  const getTabAmountOwing = (tab) => {
    if (tab?.status === "paid") return 0;
    return getTabTotalInclTip(tab);
  };

  const getTableTotalExclTip = () => {
    return tabs.reduce((sum, tab) => sum + getTabSubtotal(tab), 0);
  };

  const getTableTotalTip = () => {
    return tabs.reduce((sum, tab) => sum + getTabTip(tab), 0);
  };

  const getTableTotalInclTip = () => {
    return tabs.reduce((sum, tab) => sum + getTabTotalInclTip(tab), 0);
  };

  const getDashboardTableSummary = (tableId) => {
    const tableData = tablesById[tableId] || {};
    const guests = tableData.guests || [];
    const totalExcl = guests.reduce((sum, guest) => sum + getTabSubtotal(guest), 0);
    const totalTip = guests.reduce((sum, guest) => sum + getTabTip(guest), 0);
    const totalIncl = totalExcl + totalTip;

    return {
      waiterName: tableData.waiterName || "",
      tableStatus: tableData.tableStatus || "open",
      activeTabs: guests.filter((guest) => guest.status !== "paid").length,
      totalExcl,
      totalTip,
      totalIncl,
      joinLink: getJoinLink(tableId),
    };
  };

  const updateTable = async (partialData) => {
    if (!selectedTableId) return;
    const ref = doc(db, "tables", selectedTableId);
    await setDoc(ref, partialData, { merge: true });
  };

  const updateTabs = async (updatedTabs) => {
    await updateTable({ guests: updatedTabs });
  };

  const openTable = async (tableId) => {
    await ensureTableDocument(tableId);
    setSelectedTableId(tableId);
    setSelectedTabId(null);
    setAssignModalOpen(false);
    setSelectedMenuItem(null);
    setAssignSelections([]);
    setModifierSelections({});
    setMainTabOpen(false);
    setWaiterNameInput(tablesById[tableId]?.waiterName || "");
  };

  useEffect(() => {
    if (!selectedTableId) return;
    setWaiterNameInput(table?.waiterName || "");
  }, [selectedTableId, table?.waiterName]);

  const saveWaiterName = async () => {
    await updateTable({ waiterName: waiterNameInput.trim() });
  };

  const saveTableStatus = async (status) => {
    await updateTable({ tableStatus: status });
  };

  const addTabManually = async () => {
    const cleanedName = newTabName.trim();
    if (!cleanedName) return;

    const now = Date.now().toString();

    const newTab = {
      id: now,
      ownerName: cleanedName,
      ownerKey: `manual-${now}`,
      name: cleanedName,
      members: [cleanedName],
      viewerKeys: [],
      items: [],
      tipPercent: 10,
      status: "active",
      readyToPay: false,
      serviceRequested: false,
      paidAt: null,
      joinRequests: [],
    };

    await updateTabs([...(table?.guests || []), newTab]);
    setNewTabName("");
  };

  const closeTab = async (tabId) => {
    const tabToClose = tabs.find((tab) => tab.id === tabId);
    if (!tabToClose) return;

    if (getTabAmountOwing(tabToClose) > 0) {
      alert("This tab still has an outstanding amount and cannot be closed yet.");
      return;
    }

    const updatedTabs = tabs.filter((tab) => tab.id !== tabId);
    await updateTabs(updatedTabs);
    setSelectedTabId(null);
  };

  const markPaid = async (tabId) => {
    const updatedTabs = tabs.map((tab) =>
      tab.id === tabId
        ? {
            ...tab,
            status: "paid",
            paidAt: new Date().toISOString(),
          }
        : tab
    );

    await updateTabs(updatedTabs);
  };

  const clearService = async (tabId) => {
    const updatedTabs = tabs.map((tab) =>
      tab.id === tabId
        ? {
            ...tab,
            serviceRequested: false,
          }
        : tab
    );

    await updateTabs(updatedTabs);
  };

  const openAssignModal = (menuItem) => {
    setSelectedMenuItem(menuItem);
    setAssignSelections([]);
    setModifierSelections({});
    setAssignModalOpen(true);
  };

  const closeAssignModal = () => {
    setAssignModalOpen(false);
    setSelectedMenuItem(null);
    setAssignSelections([]);
    setModifierSelections({});
  };

  const toggleAssignSelection = (tabId) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab || tab.status === "paid") return;

    setAssignSelections((prev) => {
      if (prev.includes(tabId)) {
        return prev.filter((id) => id !== tabId);
      }
      return [...prev, tabId];
    });
  };

  const updateModifierSelection = (modifierKey, value) => {
    setModifierSelections((prev) => ({
      ...prev,
      [modifierKey]: value,
    }));
  };

  const hasAllRequiredModifiers = useMemo(() => {
    if (!selectedMenuItem?.modifiers) return true;
    return Object.keys(selectedMenuItem.modifiers).every((key) => Boolean(modifierSelections[key]));
  }, [selectedMenuItem, modifierSelections]);

  const confirmAssignItem = async () => {
    if (!selectedMenuItem || assignSelections.length === 0) return;

    if (selectedMenuItem.modifiers && !hasAllRequiredModifiers) {
      alert("Please select all required meal options first.");
      return;
    }

    const hasPaidTabSelected = assignSelections.some((selectedId) => {
      const selectedTabCheck = tabs.find((tab) => tab.id === selectedId);
      return selectedTabCheck?.status === "paid";
    });

    if (hasPaidTabSelected) {
      alert("You cannot assign items to a tab that has already been marked as paid.");
      return;
    }

    let updatedTabs = [...tabs];

    if (assignSelections.length === 1) {
      const targetTabId = assignSelections[0];

      updatedTabs = updatedTabs.map((tab) => {
        if (tab.id !== targetTabId) return tab;

        const newItem = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: selectedMenuItem.name,
          category: selectedMenuItem.category,
          description: selectedMenuItem.description,
          price: selectedMenuItem.price,
          originalPrice: selectedMenuItem.price,
          isSplit: false,
          splitCount: 1,
          splitGroupId: null,
          modifiers: { ...modifierSelections },
        };

        return {
          ...tab,
          items: [...(tab.items || []), newItem],
          serviceRequested: false,
        };
      });
    } else {
      const splitGroupId = Date.now().toString();
      const splitPrice = Number((selectedMenuItem.price / assignSelections.length).toFixed(2));

      updatedTabs = updatedTabs.map((tab) => {
        if (!assignSelections.includes(tab.id)) return tab;

        const splitItem = {
          id: `${splitGroupId}-${tab.id}`,
          name: `${selectedMenuItem.name} (Split)`,
          category: selectedMenuItem.category,
          description: selectedMenuItem.description,
          price: splitPrice,
          originalPrice: selectedMenuItem.price,
          isSplit: true,
          splitCount: assignSelections.length,
          splitGroupId,
          modifiers: { ...modifierSelections },
        };

        return {
          ...tab,
          items: [...(tab.items || []), splitItem],
          serviceRequested: false,
        };
      });
    }

    await updateTabs(updatedTabs);
    closeAssignModal();
  };

  const mainTabRows = useMemo(() => {
    const grouped = {};

    tabs.forEach((tab) => {
      (tab.items || []).forEach((item) => {
        const baseName = getBaseItemName(item.name);
        const groupKey = `${baseName}__${Number(item.originalPrice || item.price || 0)}`;

        if (!grouped[groupKey]) {
          grouped[groupKey] = {
            key: groupKey,
            name: baseName,
            qty: 0,
            unitPrice: Number(item.originalPrice || item.price || 0),
            totalPrice: 0,
            details: [],
          };
        }

        grouped[groupKey].qty += 1;
        grouped[groupKey].totalPrice += Number(item.price || 0);
        grouped[groupKey].details.push({
          itemId: item.id,
          display: formatItemModifiers(item) || "No special notes",
        });
      });
    });

    return Object.values(grouped);
  }, [tabs]);

  const mainTabButtonLabel = `Main Tab · Excl ${formatMoney(getTableTotalExclTip())} · Tip ${formatMoney(getTableTotalTip())} · Incl ${formatMoney(getTableTotalInclTip())}`;

  if (!selectedTableId) {
    return (
      <div
        style={{
          padding: 24,
          background: "#f6f7fb",
          minHeight: "100vh",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e3e7ef",
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Tables</h2>
          <div style={{ color: "#5c6b83" }}>
            Select a table to open it or scan its QR code.
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 16,
          }}
        >
          {TABLE_IDS.map((tableId) => {
            const summary = getDashboardTableSummary(tableId);

            return (
              <div
                key={tableId}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e3e7ef",
                  borderRadius: 16,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontWeight: "bold", fontSize: 20 }}>
                    Table {tableId}
                  </div>
                  <div
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: summary.tableStatus === "closed" ? "#fde9ec" : "#e8f7ee",
                      color: summary.tableStatus === "closed" ? "#c1121f" : "#1d7f49",
                      fontWeight: "bold",
                      fontSize: 12,
                    }}
                  >
                    {summary.tableStatus === "closed" ? "Table Closed" : "Table Open"}
                  </div>
                </div>

                <div style={{ color: "#5c6b83", marginBottom: 6 }}>
                  Waiter / waitress: <strong>{summary.waiterName || "Not set yet"}</strong>
                </div>
                <div style={{ color: "#5c6b83", marginBottom: 12 }}>
                  {summary.activeTabs} active tabs
                </div>

                <div style={{ marginBottom: 6 }}>
                  <strong>Total excl tip:</strong> {formatMoney(summary.totalExcl)}
                </div>
                <div style={{ marginBottom: 6 }}>
                  <strong>Total tip:</strong> {formatMoney(summary.totalTip)}
                </div>
                <div style={{ marginBottom: 14 }}>
                  <strong>Total incl tip:</strong> {formatMoney(summary.totalIncl)}
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    background: "#f8f9fc",
                    border: "1px solid #edf1f7",
                    marginBottom: 14,
                  }}
                >
                  <div style={{ fontWeight: "bold", marginBottom: 8 }}>QR Code</div>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(summary.joinLink)}`}
                    alt={`QR code for table ${tableId}`}
                    style={{
                      width: 140,
                      height: 140,
                      borderRadius: 8,
                      border: "1px solid #d9dfeb",
                      background: "#fff",
                      display: "block",
                    }}
                  />
                </div>

                <button
                  onClick={() => openTable(tableId)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: "#0f1c33",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  Open Table
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 24,
        background: "#f6f7fb",
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e3e7ef",
          borderRadius: 16,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>Table {selectedTableId}</h2>
            <div style={{ color: "#5c6b83", marginBottom: 16 }}>
              {tabs.length} active tabs
            </div>
            <div style={{ marginBottom: 6 }}>
              <strong>Total excl tip:</strong> {formatMoney(getTableTotalExclTip())}
            </div>
            <div style={{ marginBottom: 6 }}>
              <strong>Total tip:</strong> {formatMoney(getTableTotalTip())}
            </div>
            <div>
              <strong>Total incl tip:</strong> {formatMoney(getTableTotalInclTip())}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
  <button
    onClick={() => setMainTabOpen(true)}
    style={{
      padding: "10px 16px",
      borderRadius: 10,
      border: "none",
      background: "#0f1c33",
      color: "#fff",
      cursor: "pointer",
      fontWeight: "bold",
    }}
    title={mainTabButtonLabel}
  >
    {mainTabButtonLabel}
  </button>

  <button
    onClick={() => {
      setSelectedTableId(null);
      setSelectedTabId(null);
      setMainTabOpen(false);
      setAssignModalOpen(false);
    }}
    style={{
      padding: "10px 16px",
      borderRadius: 10,
      border: "1px solid #ccd3e0",
      background: "#fff",
      cursor: "pointer",
      fontWeight: "bold",
    }}
  >
    Back to Tables
  </button>
</div>
        </div>
      </div>

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e3e7ef",
          borderRadius: 16,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: 12 }}>
          Waiter / Waitress Name
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <input
            type="text"
            placeholder="Enter waiter / waitress name"
            value={waiterNameInput}
            onChange={(e) => setWaiterNameInput(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ccd3e0",
              minWidth: 260,
              maxWidth: 360,
              width: "100%",
            }}
          />
          <button
            onClick={saveWaiterName}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "none",
              background: "#0f1c33",
              color: "#fff",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Save Name
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => saveTableStatus("open")}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: table?.tableStatus === "open" ? "2px solid #1d7f49" : "1px solid #ccd3e0",
              background: table?.tableStatus === "open" ? "#e8f7ee" : "#fff",
              color: table?.tableStatus === "open" ? "#1d7f49" : "#0f1c33",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Table Open
          </button>

          <button
            onClick={() => saveTableStatus("closed")}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: table?.tableStatus === "closed" ? "2px solid #c1121f" : "1px solid #ccd3e0",
              background: table?.tableStatus === "closed" ? "#fde9ec" : "#fff",
              color: table?.tableStatus === "closed" ? "#c1121f" : "#0f1c33",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Table Closed
          </button>
        </div>
      </div>

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e3e7ef",
          borderRadius: 16,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: 14 }}>TABS</div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTabId(tab.id)}
              style={{
                borderRadius: 14,
                border: tab.serviceRequested ? "2px solid #c1121f" : "1px solid #d9dfeb",
                background: tab.serviceRequested ? "#fde9ec" : "#f3f6fb",
                padding: "12px 16px",
                minWidth: 180,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: 6 }}>
                {buildDisplayName(tab)}
              </div>
              <div style={{ fontSize: 13, color: "#5c6b83", marginBottom: 4 }}>
                Status: {tab.status}
              </div>
              <div style={{ fontSize: 13, color: "#5c6b83" }}>
                Excl tip: {formatMoney(getTabSubtotal(tab))}
              </div>
              <div style={{ fontSize: 13, color: "#5c6b83", marginTop: 4 }}>
                Tip: {formatMoney(getTabTip(tab))}
              </div>
              <div style={{ fontSize: 13, color: "#5c6b83", marginTop: 4 }}>
                Incl tip: {formatMoney(getTabTotalInclTip(tab))}
              </div>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Add new tab name"
            value={newTabName}
            onChange={(e) => setNewTabName(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ccd3e0",
              minWidth: 220,
            }}
          />
          <button
            onClick={addTabManually}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "none",
              background: "#f4a000",
              color: "#fff",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Add Tab
          </button>
        </div>
      </div>

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e3e7ef",
          borderRadius: 16,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: 14 }}>MENU</div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border:
                  activeCategory === category
                    ? "2px solid #f4a000"
                    : "1px solid #d9dfeb",
                background: activeCategory === category ? "#fff8ea" : "#f3f6fb",
                cursor: "pointer",
                fontWeight: activeCategory === category ? "bold" : "normal",
              }}
            >
              {category}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
          }}
        >
          {filteredMenu.map((item) => (
            <div
              key={`${item.category}-${item.name}`}
              style={{
                border: "1px solid #d9dfeb",
                borderRadius: 14,
                padding: 16,
                background: "#fff",
              }}
            >
              <div style={{ fontWeight: "bold", fontSize: 20, marginBottom: 8 }}>
                {item.name}
              </div>
              <div style={{ color: "#6c7a92", fontSize: 14, minHeight: 38, marginBottom: 12 }}>
                {item.description}
              </div>
              <div style={{ color: "#d98a00", fontWeight: "bold", fontSize: 18, marginBottom: 14 }}>
                {formatMoney(item.price)}
              </div>

              <button
                onClick={() => openAssignModal(item)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: "#0f1c33",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Assign Item
              </button>
            </div>
          ))}
        </div>
      </div>

      {selectedTab && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 28, 51, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              width: "100%",
              maxWidth: 700,
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: 18,
              padding: 24,
              boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 28, fontWeight: "bold" }}>
                  {buildDisplayName(selectedTab)}
                </div>
                <div style={{ color: "#6c7a92", marginTop: 6 }}>
                  Status: {selectedTab.status}
                </div>
                {selectedTab.paidAt && (
                  <div style={{ color: "#6c7a92", marginTop: 6 }}>
                    Paid at: {formatDateTime(selectedTab.paidAt)}
                  </div>
                )}
              </div>

              <button
                onClick={() => setSelectedTabId(null)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #d9dfeb",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Close
              </button>
            </div>

            <div style={{ marginBottom: 6 }}>
              <strong>Subtotal excl tip:</strong> {formatMoney(getTabSubtotal(selectedTab))}
            </div>
            <div style={{ marginBottom: 6 }}>
              <strong>Tip:</strong> {formatMoney(getTabTip(selectedTab))}
            </div>
            <div style={{ fontWeight: "bold", marginBottom: 6 }}>
              Total incl tip: {formatMoney(getTabTotalInclTip(selectedTab))}
            </div>
            <div style={{ fontWeight: "bold", marginBottom: 16 }}>
              Amount owing: {formatMoney(getTabAmountOwing(selectedTab))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: "bold", marginBottom: 8 }}>Items Ordered</div>

              {(selectedTab.items || []).length === 0 ? (
                <div style={{ color: "#6c7a92" }}>No items yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {(selectedTab.items || []).map((item, index) => (
                    <div
                      key={item.id || index}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 12,
                        background: "#f8f9fc",
                        border: "1px solid #edf1f7",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 20,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: "bold" }}>{item.name}</div>
                        <div style={{ color: "#6c7a92", marginTop: 4 }}>{item.category}</div>
                        {item.isSplit && (
                          <div style={{ color: "#d98a00", marginTop: 4 }}>
                            Split between {item.splitCount} tab(s)
                          </div>
                        )}
                        {formatItemModifiers(item) && (
                          <div style={{ color: "#6c7a92", marginTop: 4 }}>
                            {formatItemModifiers(item)}
                          </div>
                        )}
                      </div>

                      <div style={{ fontWeight: "bold" }}>{formatMoney(item.price)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {selectedTab.status !== "paid" && (
                <button
                  onClick={() => markPaid(selectedTab.id)}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 10,
                    border: "none",
                    background: "#1d7f49",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  Mark Paid
                </button>
              )}

              <button
                onClick={() => clearService(selectedTab.id)}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: selectedTab.serviceRequested ? "#c1121f" : "#0f1c33",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Service
              </button>

              <button
                onClick={() => closeTab(selectedTab.id)}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "1px solid #e0a5a5",
                  background: "#fff",
                  color: "#b42318",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Close Tab
              </button>
            </div>
          </div>
        </div>
      )}

      {assignModalOpen && selectedMenuItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 28, 51, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1100,
          }}
        >
          <div
            style={{
              background: "#fff",
              width: "100%",
              maxWidth: 620,
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: 18,
              padding: 24,
              boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ fontSize: 28, fontWeight: "bold", marginBottom: 10 }}>
              Assign: {selectedMenuItem.name}
            </div>

            <div style={{ color: "#6c7a92", marginBottom: 18 }}>
              Select one or more tabs. Cost ({formatMoney(selectedMenuItem.price)}) will be split equally.
            </div>

            {selectedMenuItem.modifiers && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: "bold", marginBottom: 12 }}>Meal Options</div>

                <div style={{ display: "grid", gap: 14 }}>
                  {Object.entries(selectedMenuItem.modifiers).map(([modifierKey, options]) => (
                    <div key={modifierKey}>
                      <div style={{ fontWeight: "bold", marginBottom: 8 }}>
                        {formatModifierLabel(modifierKey)}
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {options.map((option) => {
                          const isSelected = modifierSelections[modifierKey] === option;

                          return (
                            <button
                              key={option}
                              onClick={() => updateModifierSelection(modifierKey, option)}
                              style={{
                                padding: "10px 14px",
                                borderRadius: 10,
                                border: isSelected
                                  ? "2px solid #f4a000"
                                  : "1px solid #d9dfeb",
                                background: isSelected ? "#fff8ea" : "#f3f6fb",
                                cursor: "pointer",
                                fontWeight: isSelected ? "bold" : "normal",
                              }}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontWeight: "bold", marginBottom: 10 }}>Assign to Tabs</div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
              {tabs.map((tab) => {
                const selected = assignSelections.includes(tab.id);
                const isPaid = tab.status === "paid";

                return (
                  <button
                    key={tab.id}
                    onClick={() => toggleAssignSelection(tab.id)}
                    disabled={isPaid}
                    style={{
                      padding: "12px 16px",
                      borderRadius: 12,
                      border: selected ? "2px solid #f4a000" : "1px solid #d9dfeb",
                      background: isPaid ? "#eeeeee" : selected ? "#fff8ea" : "#f3f6fb",
                      cursor: isPaid ? "not-allowed" : "pointer",
                      fontWeight: "bold",
                      opacity: isPaid ? 0.6 : 1,
                    }}
                  >
                    {buildDisplayName(tab)} {isPaid ? "(Paid)" : ""}
                  </button>
                );
              })}
            </div>

            {assignSelections.length > 1 && (
              <div style={{ color: "#d98a00", fontWeight: "bold", marginBottom: 18 }}>
                {formatMoney(selectedMenuItem.price / assignSelections.length)} per tab
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={closeAssignModal}
                style={{
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "1px solid #d9dfeb",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Cancel
              </button>

              <button
                onClick={confirmAssignItem}
                style={{
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "none",
                  background: "#f4a000",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                {assignSelections.length > 1
                  ? `Split across ${assignSelections.length}`
                  : "Add Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {mainTabOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 28, 51, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1150,
          }}
        >
          <div
            style={{
              background: "#fff",
              width: "100%",
              maxWidth: 980,
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: 18,
              padding: 24,
              boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 28, fontWeight: "bold" }}>
                  Main Tab - Table {selectedTableId}
                </div>
                <div style={{ color: "#6c7a92", marginTop: 6 }}>
                  Combined view of all ordered items on this table.
                </div>
              </div>

              <button
                onClick={() => setMainTabOpen(false)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #d9dfeb",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Close
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(220px, 1fr) 90px 120px 140px",
                gap: 12,
                padding: "0 0 10px 0",
                borderBottom: "1px solid #e3e7ef",
                marginBottom: 14,
                fontWeight: "bold",
                color: "#5c6b83",
              }}
            >
              <div>Item</div>
              <div>Qty</div>
              <div>Cost</div>
              <div>Total Cost</div>
            </div>

            {mainTabRows.length === 0 ? (
              <div style={{ color: "#6c7a92" }}>No items ordered yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 12, marginBottom: 18 }}>
                {mainTabRows.map((row) => (
                  <div
                    key={row.key}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 14,
                      background: "#f8f9fc",
                      border: "1px solid #edf1f7",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(220px, 1fr) 90px 120px 140px",
                        gap: 12,
                        alignItems: "center",
                        marginBottom: row.details.length > 0 ? 10 : 0,
                      }}
                    >
                      <div style={{ fontWeight: "bold" }}>{row.name}</div>
                      <div style={{ fontWeight: "bold" }}>{row.qty}</div>
                      <div style={{ fontWeight: "bold" }}>{formatMoney(row.unitPrice)}</div>
                      <div style={{ fontWeight: "bold" }}>{formatMoney(row.totalPrice)}</div>
                    </div>

                    <div style={{ display: "grid", gap: 6 }}>
                      {row.details.map((detail, index) => (
                        <div key={`${detail.itemId}-${index}`} style={{ color: "#6c7a92" }}>
                          {index + 1}. {detail.display}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div
              style={{
                marginTop: 8,
                paddingTop: 16,
                borderTop: "1px solid #e3e7ef",
                display: "grid",
                gap: 6,
              }}
            >
              <div>
                <strong>Running total excl tip:</strong> {formatMoney(getTableTotalExclTip())}
              </div>
              <div>
                <strong>Running total tip:</strong> {formatMoney(getTableTotalTip())}
              </div>
              <div style={{ fontWeight: "bold" }}>
                Running total incl tip: {formatMoney(getTableTotalInclTip())}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}