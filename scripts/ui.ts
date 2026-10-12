/**
 * UI harness: drive the running dev server in headless Chrome (Bun.WebView),
 * take a screenshot and report layout problems.
 *
 *   bun run ui spells/01M4PBRKPNR6XMJM8TJWFH55NP --device=mobile
 *   bun run ui spells --device=tablet --click="button:has(svg)" --out=.ui/filters.png
 *
 * The route is the URL path (+ query). Omit its leading slash: Git Bash
 * rewrites arguments starting with "/" into Windows paths.
 *
 * --cookie=name=value (repeatable) is set before loading, e.g. a session cookie.
 *
 * Steps run in order: --type, --click, --scroll (each repeatable, applied in the
 * order given per kind). Before the screenshot, the page is given time to settle:
 * no Mantine loaders visible and no layout shift for a few frames.
 *
 * Reports: console errors/warnings from the page, horizontal overflow (elements
 * wider than the viewport), and --eval results.
 */
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";

const DEVICES = {
    mobile: [390, 844],
    tablet: [820, 1180],
    desktop: [1440, 900],
} as const;

const {values, positionals} = parseArgs({
    allowPositionals: true,
    options: {
        device: {type: "string", default: "desktop"},
        size: {type: "string"},
        base: {type: "string", default: "http://localhost:5173"},
        out: {type: "string"},
        type: {type: "string", multiple: true, default: []},
        click: {type: "string", multiple: true, default: []},
        scroll: {type: "string", multiple: true, default: []},
        eval: {type: "string", multiple: true, default: []},
        // name=value, e.g. a better-auth.session_token to view signed-in pages
        cookie: {type: "string", multiple: true, default: []},
        dpr: {type: "string", default: "1"},
        full: {type: "boolean", default: false},
        timeout: {type: "string", default: "15000"},
    },
});

const route = positionals[0] ?? "/";
const deviceName = values.device as keyof typeof DEVICES;
if (!values.size && !(deviceName in DEVICES)) {
    console.error(`Unknown device "${values.device}". Use ${Object.keys(DEVICES).join(", ")} or --size=WxH.`);
    process.exit(2);
}
const [width, height] = values.size
    ? values.size.split("x").map(Number)
    : DEVICES[deviceName];
const timeout = Number(values.timeout);

const slug = route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home";
const out = values.out ?? `.ui/${slug}-${values.size ?? deviceName}.png`;

const pageLogs: string[] = [];

await using view = new Bun.WebView({
    width,
    height,
    backend: "chrome",
    console: (type, ...args) => {
        if (type === "error" || type === "warn") {
            const text = args.map((a) => typeof a === "object" && a !== null ? JSON.stringify(a) : String(a));
            pageLogs.push(`[${type}] ${text.join(" ")}`);
        }
    },
});

// Headless Chrome won't size its window below 500px wide, so emulate the
// device viewport via DevTools instead (the first navigate opens the session)
await view.navigate("about:blank");

// Uncaught exceptions never go through console.*; collect them via DevTools
interface ExceptionThrown {
    exceptionDetails: { text: string; exception?: { description?: string } };
}
await view.cdp("Runtime.enable");
view.addEventListener("Runtime.exceptionThrown", (event) => {
    const {exceptionDetails} = (event as MessageEvent<ExceptionThrown>).data;
    const description = exceptionDetails.exception?.description ?? exceptionDetails.text;
    pageLogs.push(`[uncaught] ${description.split("\n").slice(0, 4).join("\n    ")}`);
});
await view.cdp("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: Number(values.dpr),
    mobile: width < 768,
});
if (width < 768) {
    await view.cdp("Emulation.setTouchEmulationEnabled", {enabled: true, maxTouchPoints: 5});
}

for (const cookie of values.cookie) {
    const at = cookie.indexOf("=");
    await view.cdp("Network.setCookie", {
        name: cookie.slice(0, at),
        value: cookie.slice(at + 1),
        url: values.base,
        httpOnly: true,
    });
}

await view.navigate(`${values.base}${route.startsWith("/") ? route : `/${route}`}`);

// Wait until loaders are gone, CSS transitions/animations have finished (drawers,
// modals) and layout has stopped moving for a few frames
const settle = () => view.evaluate<boolean>(`new Promise((resolve) => {
    const deadline = Date.now() + ${timeout};
    let last = "", stable = 0;
    const tick = () => {
        const loading = document.querySelector(".mantine-Loader-root") !== null
            || document.getAnimations().some((a) => a.playState === "running");
        const shape = document.body.scrollHeight + ":" + document.body.innerText.length;
        stable = !loading && shape === last ? stable + 1 : 0;
        last = shape;
        if (stable >= 10) return resolve(true);
        if (Date.now() > deadline) return resolve(false);
        requestAnimationFrame(tick);
    };
    tick();
})`);

if (!await settle()) {
    console.warn(`warning: page did not settle within ${timeout} ms`);
}

for (const text of values.type) {
    await view.type(text);
    await settle();
}
for (const selector of values.click) {
    await view.click(selector, {timeout});
    await settle();
}
for (const selector of values.scroll) {
    await view.scrollTo(selector, {block: "start", timeout});
    await settle();
}

// Horizontal overflow, two kinds:
//  - offscreen: elements past the viewport's right edge with no clipping ancestor
//  - clipped:   containers (overflow hidden/auto/scroll) whose content is wider
//               than they are — either cut off or scrolling sideways. Expected
//               for wide tables on mobile; anything else is usually a bug.
const overflow = await view.evaluate<{ offscreen: string[]; clipped: string[] }>(`(() => {
    const vw = document.documentElement.clientWidth;
    const clips = (o) => o === "auto" || o === "scroll" || o === "hidden";
    const name = (el) => el.tagName.toLowerCase() + (typeof el.className === "string" && el.className.trim()
        ? "." + el.className.trim().split(/\\s+/).slice(0, 2).join(".") : "");
    const offscreen = [], clipped = [];
    for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el);
        if (clips(cs.overflowX) && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) {
            clipped.push(name(el) + ": content " + el.scrollWidth + "px in " + el.clientWidth + "px (" + cs.overflowX + ")");
        }
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > vw + 1) {
            let p = el.parentElement;
            while (p && !clips(getComputedStyle(p).overflowX)) p = p.parentElement;
            if (!p) offscreen.push(name(el) + ": right edge " + Math.round(r.right) + "px (viewport " + vw + "px)");
        }
    }
    return {offscreen: offscreen.slice(0, 10), clipped: clipped.slice(0, 10)};
})()`);

for (const expr of values.eval) {
    console.log(`eval ${expr}\n  →`, JSON.stringify(await view.evaluate(expr), null, 2));
}

if (values.full) {
    const fullHeight = await view.evaluate<number>("document.documentElement.scrollHeight");
    await view.resize(Math.max(width, 500), Math.min(fullHeight, 16384));
    await view.cdp("Emulation.setDeviceMetricsOverride", {
        width,
        height: Math.min(fullHeight, 16384),
        deviceScaleFactor: Number(values.dpr),
        mobile: width < 768,
    });
    await settle();
}

await mkdir(dirname(out), {recursive: true});
await Bun.write(out, await view.screenshot());

console.log(`screenshot  ${out}  (${width}×${height}, ${route})`);
const report = (label: string, lines: string[]) =>
    console.log(lines.length ? `${label.padEnd(12)}${lines.length}:\n  ${lines.join("\n  ")}` : `${label.padEnd(12)}none`);
report("offscreen", overflow.offscreen);
report("clipped", overflow.clipped);
console.log(pageLogs.length ? `console     ${pageLogs.length} message(s):\n  ${pageLogs.join("\n  ")}` : "console     clean");
