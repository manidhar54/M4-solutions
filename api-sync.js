const API_BASE = "/api";

window.M4_API = {
  getToken: () => localStorage.getItem("m4.jwt.token"),
  setToken: (t) => (t ? localStorage.setItem("m4.jwt.token", t) : localStorage.removeItem("m4.jwt.token")),
  getUser: () => {
    try { return JSON.parse(localStorage.getItem("m4.jwt.user")); } catch { return null; }
  },
  setUser: (u) => (u ? localStorage.setItem("m4.jwt.user", JSON.stringify(u)) : localStorage.removeItem("m4.jwt.user")),

  async request(path, method = "GET", body = null) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const headers = { "Content-Type": "application/json" };
      const token = this.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
        signal: controller.signal
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "API request failed");
      return data;
    } finally {
      clearTimeout(timer);
    }
  },

  async login(email, password, portal) {
    const data = await this.request("/auth/login", "POST", { email, password, portal });
    this.setToken(data.token);
    this.setUser(data.user);
    return data.user;
  },

  async fetchWorkspace() {
    return await this.request("/workspace", "GET");
  },

  async syncChanges(prev, curr) {
    if (!this.getToken() || !prev || !curr) return;
    const collections = [
      { key: "employees", path: "/users" },
      { key: "projects", path: "/projects" },
      { key: "tasks", path: "/tasks" },
      { key: "meetings", path: "/meetings" },
      { key: "messages", path: "/messages" },
      { key: "documents", path: "/documents" }
    ];

    for (const { key, path } of collections) {
      const oldMap = new Map((prev[key] || []).map((x) => [x.id, x]));
      const newMap = new Map((curr[key] || []).map((x) => [x.id, x]));

      for (const [id] of oldMap) {
        if (!newMap.has(id) && /^[a-f0-9]{24}$/i.test(id)) {
          await this.request(`${path}/${id}`, "DELETE").catch(console.error);
        }
      }

      for (const [id, item] of newMap) {
        if (!oldMap.has(id)) {
          const payload = { ...item };
          delete payload.id;
          try {
            const created = await this.request(path, "POST", payload);
            if (created?.id) item.id = created.id;
          } catch (err) {
            console.error("Create sync error:", err);
            alert("MongoDB save failed: " + err.message);
          }
        } else if (JSON.stringify(oldMap.get(id)) !== JSON.stringify(item)) {
          const payload = { ...item };
          delete payload.id;
          if (/^[a-f0-9]{24}$/i.test(id) && ["/users", "/projects", "/tasks", "/meetings", "/messages", "/documents"].includes(path)) {
            await this.request(`${path}/${id}`, "PUT", payload).catch(console.error);
          }
        }
      }
    }
  }
};

(() => {
  const STORAGE_KEY = "m4.workspace.v3";
  let lastSnapshot = null;
  const origGetItem = localStorage.getItem.bind(localStorage);
  const origSetItem = localStorage.setItem.bind(localStorage);

  localStorage.getItem = function (key) {
    if (key === STORAGE_KEY) {
      const user = window.M4_API.getUser();
      const cached = origGetItem(STORAGE_KEY);
      let stateObj;
      if (cached) {
        try {
          stateObj = JSON.parse(cached);
          stateObj.currentUserId = user ? user.id : null;
        } catch {}
      }
      if (!stateObj) {
        stateObj = {
          employees: user ? [user] : [],
          projects: [],
          tasks: [],
          meetings: [],
          messages: [],
          documents: [],
          notifications: [],
          currentUserId: user ? user.id : null,
          company: { name: "M4 Solutions", timezone: "Asia/Kolkata" }
        };
      }
      if (!lastSnapshot) {
        lastSnapshot = JSON.parse(JSON.stringify(stateObj));
      }
      return JSON.stringify(stateObj);
    }
    return origGetItem(key);
  };

  localStorage.setItem = function (key, value) {
    origSetItem(key, value);
    if (key === STORAGE_KEY) {
      try {
        const curr = JSON.parse(value);
        if (!curr.currentUserId && window.M4_API.getToken()) {
          window.M4_API.setToken(null);
          window.M4_API.setUser(null);
          lastSnapshot = null;
          return;
        }
        if (lastSnapshot && window.M4_API.getToken()) {
          const prevCopy = lastSnapshot;
          lastSnapshot = JSON.parse(JSON.stringify(curr));
          window.M4_API.syncChanges(prevCopy, curr).then(() => {
            origSetItem(STORAGE_KEY, JSON.stringify(curr));
            lastSnapshot = JSON.parse(JSON.stringify(curr));
          });
        } else {
          lastSnapshot = JSON.parse(JSON.stringify(curr));
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  async function pullFromMongo(reloadPage = false) {
    if (!window.M4_API.getToken()) return;
    try {
      const data = await window.M4_API.fetchWorkspace();
      const user = window.M4_API.getUser();
      const fullState = {
        employees: data.users,
        projects: data.projects,
        tasks: data.tasks,
        meetings: data.meetings,
        messages: data.messages,
        documents: data.documents,
        notifications: [],
        currentUserId: user ? user.id : null,
        company: { name: "M4 Solutions", timezone: "Asia/Kolkata" }
      };
      origSetItem(STORAGE_KEY, JSON.stringify(fullState));
      lastSnapshot = JSON.parse(JSON.stringify(fullState));
      if (reloadPage) location.reload();
    } catch (err) {
      console.error("Workspace sync failed:", err);
      alert("Backend connection error: Make sure 'node server.js' is running on port 5000.");
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    if (window.M4_API.getToken()) {
      pullFromMongo(false);
    }

    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        const email = document.getElementById("loginEmail").value.trim().toLowerCase();
        const pwd = document.getElementById("loginPassword").value;
        const portal = document.getElementById("tabFounder")?.classList.contains("active") ? "founder" : "employee";
        try {
          await window.M4_API.login(email, pwd, portal);
          await pullFromMongo(true);
        } catch (err) {
          alert(err.message || "Invalid email or password.");
        }
      }, true);
    }
  });
})();
