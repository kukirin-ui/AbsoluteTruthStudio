import type { ProjectFile } from "./types";

export function normalizeId(path: string) {
  return path
    .replace(/^\.?\//, "")
    .replace(/\.(tsx|ts|jsx|js)$/i, "")
    .replace(/\\/g, "/");
}

export function resolveModuleId(fromId: string, spec: string, keys: string[]) {
  if (spec === "react" || spec === "react-dom" || spec === "react-dom/client" || spec === "react/jsx-runtime") {
    return spec;
  }
  if (/\.css$/i.test(spec)) return spec;
  let id = spec.replace(/\\/g, "/");
  if (id.startsWith("@/")) id = "src/" + id.slice(2);
  else if (id.startsWith(".")) {
    const fromDir = fromId.split("/").slice(0, -1);
    const parts = [...fromDir, ...id.split("/")];
    const out: string[] = [];
    for (const p of parts) {
      if (p === "." || p === "") continue;
      if (p === "..") out.pop();
      else out.push(p);
    }
    id = out.join("/");
  }
  id = normalizeId(id);
  const cands = [id, `src/${id}`, id.replace(/^src\//, ""), `${id}/index`, `src/${id}/index`];
  for (const c of cands) {
    if (keys.includes(c)) return c;
  }
  const base = id.split("/").pop() ?? id;
  const hit = keys.find((k) => k === base || k.endsWith(`/${base}`) || k.endsWith(`/${base}/index`));
  return hit ?? null;
}

export function hasReactApp(files: ProjectFile[]) {
  return files.some((f) => {
    if (!/\.(tsx|jsx)$/i.test(f.path) && f.language !== "tsx" && f.language !== "jsx") return false;
    return /export\s+default|function\s+App\b/.test(f.content);
  });
}

const DATA_STUB = `
const KEY = "ats-live-app";
function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; }
}
function write(rows) {
  localStorage.setItem(KEY, JSON.stringify(rows));
  return rows;
}
export function load() { return read(); }
export function save(rows) { return write(rows); }
export function list() { return read(); }
export function create(item) {
  const rows = read();
  const next = { id: Date.now().toString(36), ...item };
  rows.unshift(next);
  write(rows);
  return next;
}
export function update(id, patch) {
  const rows = read().map(function(r){ return r.id === id ? Object.assign({}, r, patch) : r; });
  return write(rows);
}
export function remove(id) { return write(read().filter(function(r){ return r.id !== id; })); }
export default { load: load, save: save, list: list, create: create, update: update, remove: remove };
`;

export function collectModules(files: ProjectFile[]) {
  const modules: Record<string, string> = {};
  for (const f of files) {
    if (
      !/\.(tsx|ts|jsx|js)$/i.test(f.path) &&
      f.language !== "tsx" &&
      f.language !== "jsx" &&
      f.language !== "ts" &&
      f.language !== "typescript" &&
      f.language !== "javascript"
    ) {
      continue;
    }
    modules[normalizeId(f.path)] = f.content.replace(/^\uFEFF/, "");
  }
  const keys = Object.keys(modules);
  if (!keys.some((k) => /(?:^|\/)lib\/data$/.test(k))) {
    modules["src/lib/data"] = DATA_STUB;
  }
  return modules;
}

export function buildAppRuntimeHtml(files: ProjectFile[]) {
  const css = files
    .filter((f) => f.language === "css" || f.path.endsWith(".css"))
    .map((f) => f.content)
    .join("\n");

  const modules = collectModules(files);
  const keys = Object.keys(modules);
  const entry =
    keys.find((k) => /(?:^|\/)App$/i.test(k)) ??
    keys.find((k) => /main$/i.test(k)) ??
    keys[0];

  const payload = JSON.stringify({ modules, entry, keys });

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      html,body,#root{margin:0;min-height:100%;background:#020617;color:#e8eef8}
      body{font-family:Outfit,ui-sans-serif,system-ui,sans-serif}
      ${css}
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js" crossorigin></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script>
    (function(){
      const payload = ${payload};
      const cache = {};
      function stub() {
        const fn = function(){ return []; };
        return new Proxy({ default: fn, __esModule: true }, {
          get: function(t, p) {
            if (p in t) return t[p];
            if (p === "__esModule") return true;
            return fn;
          }
        });
      }
      function resolve(fromId, spec) {
        if (spec === "react" || spec === "react-dom" || spec === "react-dom/client" || spec === "react/jsx-runtime") return spec;
        if (/\\.css$/i.test(spec)) return spec;
        var id = String(spec).replace(/\\\\/g, "/");
        if (id.indexOf("@/") === 0) id = "src/" + id.slice(2);
        else if (id.charAt(0) === ".") {
          var fromDir = fromId.split("/").slice(0, -1);
          var parts = fromDir.concat(id.split("/"));
          var out = [];
          for (var i = 0; i < parts.length; i++) {
            var p = parts[i];
            if (p === "." || p === "") continue;
            if (p === "..") out.pop();
            else out.push(p);
          }
          id = out.join("/");
        }
        id = id.replace(/^\\.\\//, "").replace(/\\.(tsx|ts|jsx|js)$/i, "");
        var cands = [id, "src/" + id, id.replace(/^src\\//, ""), id + "/index", "src/" + id + "/index"];
        for (var c = 0; c < cands.length; c++) {
          if (payload.modules[cands[c]]) return cands[c];
        }
        var base = id.split("/").pop();
        var keys = payload.keys || Object.keys(payload.modules);
        for (var k = 0; k < keys.length; k++) {
          var key = keys[k];
          if (key === base || key.slice(-base.length-1) === "/" + base) return key;
        }
        return id;
      }
      function load(id) {
        if (id === "react" || id === "react/jsx-runtime") return React;
        if (id === "react-dom" || id === "react-dom/client") return ReactDOM;
        if (/\\.css$/i.test(id)) return {};
        if (cache[id]) return cache[id].exports;
        var src = payload.modules[id];
        if (!src) {
          cache[id] = { exports: stub() };
          return cache[id].exports;
        }
        var mod = { exports: {} };
        cache[id] = mod;
        var transformed;
        try {
          transformed = Babel.transform(src, {
            presets: ["typescript", ["react", { runtime: "classic" }]],
            plugins: ["transform-modules-commonjs"],
            filename: id + ".tsx",
            babelrc: false,
            configFile: false
          }).code;
        } catch (err) {
          throw new Error("Compile " + id + ": " + (err && err.message ? err.message : err));
        }
        var req = function(spec){ return load(resolve(id, spec)); };
        var fn = new Function("exports", "require", "module", "React", "ReactDOM", transformed);
        fn(mod.exports, req, mod, React, ReactDOM);
        return mod.exports;
      }
      try {
        if (!payload.entry) throw new Error("No React entry file");
        var app = load(payload.entry);
        var Comp = app.default || app.App || app;
        if (typeof Comp !== "function") throw new Error("App did not export a component");
        var root = ReactDOM.createRoot(document.getElementById("root"));
        root.render(React.createElement(Comp));
      } catch (err) {
        document.getElementById("root").innerHTML =
          '<div style="padding:24px;font:14px ui-sans-serif,system-ui;color:#e8eef8">' +
          '<p style="letter-spacing:.16em;text-transform:uppercase;color:#94a3b8;font-size:11px">App runtime</p>' +
          '<p style="margin-top:8px">' + String(err && err.message ? err.message : err) + '</p></div>';
      }
    })();
    </script>
  </body>
</html>`;
}
