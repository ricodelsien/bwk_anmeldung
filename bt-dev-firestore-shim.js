/**
 * Lokale Firestore-Simulation für ?dev=1 (localhost / file / insecure=1).
 * Gemeinsamer Speicher: localStorage bwk_bt_dev_store_v2 — index.html & admin.html.
 */
(function () {
  'use strict';

  const devPublic = window.BWK_BT_DEV_MODE;
  const devAdmin = window.BWK_ADMIN_DEV_MODE;
  if (!devPublic && !devAdmin) return;

  const LS_KEY = 'bwk_bt_dev_store_v2';
  const DEMO_EMAIL = 'lehrer@bwk-demo.de';
  const DEMO_PASSWORD = 'Bewerbertag-Demo!';

  function loadRaw() {
    try {
      const s = localStorage.getItem(LS_KEY);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  }

  function saveRaw(obj) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn('Dev-Shim: localStorage', e);
    }
    window.dispatchEvent(new CustomEvent('bwk-dev-db-changed'));
  }

  function deepClone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function defaultStore() {
    const defs = window.BWK_BT_DEFAULTS && window.BWK_BT_DEFAULTS.settings
      ? deepClone(window.BWK_BT_DEFAULTS.settings)
      : { useSlots: true, infoWhenNoSlots: '', slots: [], updatedAt: Date.now() };
    defs.updatedAt = Date.now();
    return {
      bewerbertag: {},
      bewerbertag_settings: {
        singleton: defs,
      },
    };
  }

  function readStore() {
    const raw = loadRaw();
    if (raw && raw.bewerbertag && raw.bewerbertag_settings) return raw;
    return defaultStore();
  }

  let store = readStore();

  function persist() {
    saveRaw(store);
  }

  function genId() {
    return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  function createdMs(v) {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    if (v && typeof v.toDate === 'function') {
      try {
        return v.toDate().getTime();
      } catch {
        return 0;
      }
    }
    return 0;
  }

  const listeners = new Set();
  function notify() {
    listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    });
  }

  window.addEventListener('storage', (e) => {
    if (e.key === LS_KEY && e.newValue) {
      try {
        store = JSON.parse(e.newValue);
        notify();
      } catch {
        /* */
      }
    }
  });

  window.addEventListener('bwk-dev-db-changed', () => {
    store = readStore();
    notify();
  });

  function docSnap(id, data) {
    return {
      id,
      exists: data != null,
      data() {
        return data ? deepClone(data) : undefined;
      },
    };
  }

  function makeQuerySnap(docs) {
    const list = docs.slice();
    return {
      forEach(cb) {
        list.forEach((x) => cb(x.snap));
      },
      get docs() {
        return list.map((x) => x.snap);
      },
    };
  }

  function collectionData(name) {
    if (!store[name]) store[name] = {};
    return store[name];
  }

  function CollectionRef(name) {
    this._name = name;
  }

  CollectionRef.prototype.doc = function (id) {
    return new DocRef(this._name, id);
  };

  CollectionRef.prototype.add = function (data) {
    const id = genId();
    const col = collectionData(this._name);
    col[id] = deepClone(data);
    persist();
    notify();
    return Promise.resolve({ id });
  };

  CollectionRef.prototype.where = function (field, op, value) {
    return new Query(this._name, null, null, [{ field, op, value }]);
  };

  CollectionRef.prototype.orderBy = function (field, dir) {
    return new Query(this._name, field, dir || 'desc', []);
  };

  function DocRef(colName, id) {
    this._col = colName;
    this.id = id;
  }

  DocRef.prototype.get = function () {
    const col = collectionData(this._col);
    const data = col[this.id];
    return Promise.resolve(docSnap(this.id, data));
  };

  DocRef.prototype.set = function (data, opts) {
    const col = collectionData(this._col);
    if (opts && opts.merge && col[this.id]) {
      col[this.id] = Object.assign(deepClone(col[this.id]), deepClone(data));
    } else {
      col[this.id] = deepClone(data);
    }
    persist();
    notify();
    return Promise.resolve();
  };

  DocRef.prototype.update = function (patch) {
    const col = collectionData(this._col);
    if (!col[this.id]) return Promise.reject(new Error('No document'));
    col[this.id] = Object.assign(deepClone(col[this.id]), deepClone(patch));
    persist();
    notify();
    return Promise.resolve();
  };

  DocRef.prototype.delete = function () {
    const col = collectionData(this._col);
    if (!col[this.id]) return Promise.resolve();
    delete col[this.id];
    persist();
    notify();
    return Promise.resolve();
  };

  function filterMatches(data, f) {
    if (!f || f.op !== '==') return true;
    return data[f.field] === f.value;
  }

  /** @param filters {{field:string, op:string, value:unknown}[]} */
  function Query(colName, orderField, orderDir, filters) {
    this._col = colName;
    this._orderField = orderField;
    this._orderDir = orderDir || 'desc';
    this._filters = filters || [];
  }

  Query.prototype.where = function (field, op, value) {
    return new Query(this._col, this._orderField, this._orderDir, [
      ...this._filters,
      { field, op, value },
    ]);
  };

  Query.prototype.orderBy = function (field, dir) {
    return new Query(this._col, field, dir || 'desc', this._filters);
  };

  Query.prototype._run = function () {
    const col = collectionData(this._col);
    let rows = Object.keys(col).map((id) => ({ id, data: col[id] }));
    rows = rows.filter((r) => this._filters.every((f) => filterMatches(r.data, f)));
    if (this._orderField) {
      rows.sort((a, b) => {
        const av = createdMs(a.data[this._orderField]);
        const bv = createdMs(b.data[this._orderField]);
        return this._orderDir === 'desc' ? bv - av : av - bv;
      });
    }
    return rows.map((r) => ({
      snap: docSnap(r.id, r.data),
    }));
  };

  Query.prototype.get = function () {
    return Promise.resolve(makeQuerySnap(this._run()));
  };

  Query.prototype.onSnapshot = function (onNext, onError) {
    const self = this;
    const run = () => {
      try {
        const snaps = self._run();
        onNext(makeQuerySnap(snaps));
      } catch (e) {
        if (onError) onError(e);
      }
    };
    listeners.add(run);
    run();
    return function unsub() {
      listeners.delete(run);
    };
  };

  function DevFirestore() {}
  DevFirestore.prototype.collection = function (name) {
    return new CollectionRef(name);
  };

  function WriteBatch() {
    this._ops = [];
  }

  WriteBatch.prototype.update = function (docRef, data) {
    if (!docRef || docRef._col == null) throw new Error('Invalid document reference');
    this._ops.push({ ref: docRef, data: deepClone(data) });
  };

  WriteBatch.prototype.commit = function () {
    this._ops.forEach((op) => {
      const col = collectionData(op.ref._col);
      if (!col[op.ref.id]) return;
      col[op.ref.id] = Object.assign(deepClone(col[op.ref.id]), op.data);
    });
    this._ops = [];
    persist();
    notify();
    return Promise.resolve();
  };

  DevFirestore.prototype.batch = function () {
    return new WriteBatch();
  };

  window.__bwkDevFirestore = new DevFirestore();

  /** Nur für admin.html: Demo-Login ohne Firebase Auth */
  if (devAdmin) {
    const authListeners = [];
    let fakeUser = null;

    function authNotify() {
      authListeners.forEach((cb) => {
        try {
          cb(fakeUser);
        } catch (e) {
          console.error(e);
        }
      });
    }

    window.__bwkDevAuth = {
      onAuthStateChanged(cb) {
        authListeners.push(cb);
        setTimeout(() => cb(fakeUser), 0);
        return function () {
          const i = authListeners.indexOf(cb);
          if (i >= 0) authListeners.splice(i, 1);
        };
      },
      signInWithEmailAndPassword(email, password) {
        const em = (email || '').trim().toLowerCase();
        if (em === DEMO_EMAIL.toLowerCase() && password === DEMO_PASSWORD) {
          fakeUser = { email: DEMO_EMAIL, uid: 'dev-lehrer-demo' };
          authNotify();
          return Promise.resolve({ user: fakeUser });
        }
        return Promise.reject({ code: 'auth/wrong-password', message: 'Demo-Zugang ungültig.' });
      },
      signOut() {
        fakeUser = null;
        authNotify();
        return Promise.resolve();
      },
      get currentUser() {
        return fakeUser;
      },
    };

    window.BWK_DEV_DEMO_LOGIN = { email: DEMO_EMAIL, password: DEMO_PASSWORD };
  }

  window.bwkDevResetDemoData = function bwkDevResetDemoData() {
    store = defaultStore();
    const col = collectionData('bewerbertag');
    const samples = [
      {
        salutation: 'herr',
        firstName: 'Alex',
        lastName: 'Muster',
        email: 'bewerber@demo.test',
        emailLower: 'bewerber@demo.test',
        phone: '030 123456',
        slot: '2026-04-13-10',
        contactType: 'mail',
        message: 'Demo-Eintrag',
        privacyAccepted: true,
        status: 'active',
        waitlistOnly: false,
        createdAt: Date.now() - 86400000 * 2,
      },
      {
        salutation: 'frau',
        firstName: 'Erika',
        lastName: 'Muster',
        email: 'bewerber@demo.test',
        emailLower: 'bewerber@demo.test',
        phone: '',
        slot: '2026-04-17-14',
        contactType: 'phone',
        message: 'Zweite Zeile gleiche E-Mail',
        privacyAccepted: true,
        status: 'active',
        waitlistOnly: false,
        createdAt: Date.now() - 86400000,
      },
      {
        salutation: 'divers',
        firstName: 'Spam',
        lastName: 'Test',
        email: 'spam@example.com',
        emailLower: 'spam@example.com',
        phone: '',
        slot: '2026-04-17-14',
        contactType: 'mail',
        message: '',
        privacyAccepted: true,
        status: 'spam',
        waitlistOnly: false,
        createdAt: Date.now() - 3600000,
      },
    ];
    samples.forEach((row) => {
      col[genId()] = row;
    });
    persist();
    notify();
  };
})();
