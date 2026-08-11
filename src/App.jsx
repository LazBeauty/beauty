import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Scissors, MapPin, Search, Star, Calendar, Clock, Check, X,
  ChevronLeft, Sparkles, Bell, Loader2, Plus, Trash2, Pencil, User, Home, Phone, Info
} from "lucide-react";
import { supabase } from "./lib/supabase";

const CITIES = [
  "Скопје","Куманово","Битола","Прилеп","Тетово","Велес","Штип","Охрид","Гостивар","Струмица",
  "Кавадарци","Кочани","Кичево","Струга","Радовиш","Гевгелија","Дебар","Крива Паланка","Свети Николе",
  "Неготино","Делчево","Виница","Кратово","Берово","Македонски Брод","Пробиштип","Ресен","Демир Хисар",
  "Валандово","Богданци","Демир Капија","Пехчево","Крушево","Македонска Каменица"
];
const CATEGORIES = [
  { id: "manikir", name: "Маникир", icon: "💅" },
  { id: "pedikir", name: "Педикир", icon: "🦶" },
  { id: "masaza", name: "Масажа на лице", icon: "🧖‍♀️" },
  { id: "vegi", name: "Веѓи / трепки", icon: "👁️" },
];
const SUGGESTED_TIMES = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
const STATUS_LABEL = { pending: "На чекање", accepted: "Прифатено", declined: "Одбиено", cancelled: "Откажано" };
const STATUS_COLOR = {
  pending: "bg-[#F5E9C8] text-[#8A6D1D]",
  accepted: "bg-[#DCE6DE] text-[#3A5544]",
  declined: "bg-[#F2DCDC] text-[#8A4A4A]",
  cancelled: "bg-[#EDE3E0] text-[#8B7A8E]",
};

const fmt = (n) => `${n} ден.`;
const initials = (name) => (name || "").split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2);
const catInfo = (id) => CATEGORIES.find(c => c.id === id) || { icon: "💫", name: id };
const todayStr = () => new Date().toISOString().slice(0,10);
const isFutureSlot = (date, time) => new Date(`${date}T${time}:00`) > new Date();
const formatDate = (ds) => {
  const d = new Date(ds + "T00:00:00");
  const s = d.toLocaleDateString("mk-MK", { weekday: "short", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const needsRating = (b) => {
  if (b.status !== "accepted" || b.rating != null || !b.date || !b.time) return false;
  const dt = new Date(`${b.date}T${b.time}:00`);
  dt.setHours(dt.getHours() + 2);
  return dt <= new Date();
};

function Logo({ size = 22 }) {
  return (
    <div className="flex items-center gap-2">
      <div style={{ width: size + 10, height: size + 10 }} className="rounded-xl bg-[#B5566B] flex items-center justify-center shrink-0">
        <Sparkles size={size - 4} className="text-[#FDF9F7]" />
      </div>
      <span className="font-serif text-[#2B1B2E] tracking-tight" style={{ fontSize: size - 2, fontWeight: 600 }}>Termin</span>
    </div>
  );
}
function Spinner() {
  return <div className="flex-1 flex items-center justify-center py-16"><Loader2 className="animate-spin text-[#B5566B]" size={22} /></div>;
}
function TextField(props) {
  return <input {...props} className={"bg-white border border-[#EDE3E0] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#B5566B] " + (props.className || "")} />;
}
function Avatar({ url, name, size = 44 }) {
  return (
    <div style={{ width: size, height: size }} className="rounded-full bg-[#EAD3DC] flex items-center justify-center text-[#8A4A5A] font-semibold shrink-0 overflow-hidden">
      {url ? <img src={url} className="w-full h-full object-cover" alt="" /> : <span style={{ fontSize: size * 0.32 }}>{initials(name)}</span>}
    </div>
  );
}

// ---------------- Avatar picker (upload/remove) ----------------
function AvatarPicker({ url, onChange, size = 76 }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { console.error(error); setUploading(false); alert("Не успеа да се качи сликата, обиди се повторно."); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setUploading(false);
    onChange(data.publicUrl);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div style={{ width: size, height: size }} className="rounded-full bg-[#EAD3DC] flex items-center justify-center overflow-hidden relative shrink-0">
        {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <User size={size * 0.4} className="text-[#8A4A5A]" />}
        {uploading && <div className="absolute inset-0 bg-black/30 flex items-center justify-center"><Loader2 size={18} className="animate-spin text-white" /></div>}
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={() => inputRef.current?.click()} className="text-[#B5566B] text-xs font-medium">{url ? "Смени слика" : "Додади слика"}</button>
        {url && <button type="button" onClick={() => onChange(null)} className="text-[#8B7A8E] text-xs font-medium">Избриши</button>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ---------------- Searchable city combobox ----------------
function CityCombobox({ value, onChange, placeholder = "Пребарај град..." }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  useEffect(() => setQuery(value || ""), [value]);
  const filtered = CITIES.filter(c => c.toLowerCase().includes(query.toLowerCase())).slice(0, 8);

  return (
    <div className="relative">
      <TextField
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-[#EDE3E0] rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {filtered.map(c => (
            <button key={c} type="button" onMouseDown={() => { onChange(c); setQuery(c); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm text-[#2B1B2E] hover:bg-[#F2EAE7]">{c}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Real month calendar ----------------
function MonthCalendar({ selectedDate, onSelect, availableDates }) {
  const [viewDate, setViewDate] = useState(() => selectedDate ? new Date(selectedDate + "T00:00:00") : new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayStr();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = viewDate.toLocaleDateString("mk-MK", { month: "long", year: "numeric" });
  const dateStr = (d) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <div className="bg-white border border-[#EDE3E0] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="w-7 h-7 rounded-full flex items-center justify-center text-[#8B7A8E] hover:bg-[#F2EAE7]">‹</button>
        <span className="text-sm font-medium text-[#2B1B2E] capitalize">{monthLabel}</span>
        <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="w-7 h-7 rounded-full flex items-center justify-center text-[#8B7A8E] hover:bg-[#F2EAE7]">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[#B3A5B5] mb-1.5">
        {["Пон","Вто","Сре","Чет","Пет","Саб","Нед"].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const ds = dateStr(d);
          const isPast = ds < today;
          const isAvailable = !availableDates || availableDates.has(ds);
          const disabled = isPast || !isAvailable;
          const isSelected = selectedDate === ds;
          return (
            <button key={i} disabled={disabled} onClick={() => onSelect(ds)}
              className={`aspect-square rounded-lg text-xs flex items-center justify-center transition-colors
                ${isSelected ? "bg-[#B5566B] text-white font-medium" :
                  disabled ? "text-[#D8CDD1]" :
                  availableDates ? "bg-[#DCE6DE] text-[#2B1B2E] font-medium" :
                  "text-[#2B1B2E] hover:bg-[#F2EAE7]"}`}>
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Role select ----------------
function RoleSelect({ onPick }) {
  return (
    <div className="min-h-full flex flex-col bg-[#FDF9F7] px-6 pt-10 pb-8">
      <Logo size={26} />
      <div className="mt-10">
        <h1 className="font-serif text-[#2B1B2E] text-3xl leading-tight" style={{ fontWeight: 600 }}>
          Убавина,<br/>закажана лесно.
        </h1>
        <p className="text-[#6B5A6E] mt-3 text-[15px] leading-relaxed">
          Поврзи се со салони и Artist-и за нокти, масажа и веѓи низ цела Македонија — или понуди сопствена услуга.
        </p>
      </div>
      <div className="mt-10 flex flex-col gap-4">
        <button onClick={() => onPick("client")} className="group text-left rounded-2xl border border-[#EDE3E0] bg-white p-5 flex items-center gap-4 hover:border-[#B5566B] transition-colors">
          <div className="w-12 h-12 rounded-xl bg-[#F2D9CE] flex items-center justify-center shrink-0">
            <Search size={20} className="text-[#8A4A5A]" />
          </div>
          <div>
            <div className="font-serif text-[#2B1B2E] text-lg" style={{ fontWeight: 600 }}>Ми треба услуга</div>
            <div className="text-[#8B7A8E] text-sm">Пронајди и закажи термин</div>
          </div>
        </button>
        <button onClick={() => onPick("provider")} className="group text-left rounded-2xl border border-[#EDE3E0] bg-white p-5 flex items-center gap-4 hover:border-[#B5566B] transition-colors">
          <div className="w-12 h-12 rounded-xl bg-[#DCE6DE] flex items-center justify-center shrink-0">
            <Scissors size={20} className="text-[#4A6B54]" />
          </div>
          <div>
            <div className="font-serif text-[#2B1B2E] text-lg" style={{ fontWeight: 600 }}>Давам услуга</div>
            <div className="text-[#8B7A8E] text-sm">Прими нарачки и управувај со термини</div>
          </div>
        </button>
      </div>
      <p className="text-[#B3A5B5] text-xs mt-auto pt-10 text-center">Termin · твоите резервации се реални и се зачувуваат</p>
    </div>
  );
}

// ---------------- Client auth ----------------
function GoogleButton({ onClick, disabled }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className="w-full flex items-center justify-center gap-2 bg-white border border-[#EDE3E0] text-[#2B1B2E] rounded-xl py-3.5 text-sm font-medium disabled:opacity-50">
      <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.3-.1-2.7-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.5 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3c-7.5 0-14 4.1-17.7 10.2z"/><path fill="#4CAF50" d="M24 45c5.4 0 10.3-1.8 14.1-4.9l-6.5-5.5C29.5 36.4 26.9 37 24 37c-5.3 0-9.7-3.1-11.3-7.8l-6.5 5C9.9 40.9 16.4 45 24 45z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.5 5.5C41 35.9 44 30.4 44 24c0-1.3-.1-2.7-.4-3.5z"/></svg>
      Продолжи со Google
    </button>
  );
}
function Divider() {
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px bg-[#EDE3E0]" /><span className="text-[#B3A5B5] text-xs">или</span><div className="flex-1 h-px bg-[#EDE3E0]" />
    </div>
  );
}
const googleSignIn = () => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });

function ClientAuth({ onBack }) {
  const [mode, setMode] = useState("choose"); // choose | login | signup | forgot | reset
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const login = async () => {
    setError(""); setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) setError("Погрешна е-пошта или лозинка.");
  };

  const sendResetCode = async () => {
    setError("");
    if (!resetEmail.trim()) { setError("Внеси ја е-поштата."); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail.trim());
    setLoading(false);
    if (err) { setError("Настана грешка, обиди се повторно."); return; }
    setMode("reset");
  };

  const confirmReset = async () => {
    setError("");
    if (resetCode.trim().length !== 8) { setError("Внеси го целиот код од 8 бројки."); return; }
    if (newPassword.length < 6) { setError("Лозинката мора да има барем 6 карактери."); return; }
    if (newPassword !== confirmNewPassword) { setError("Лозинките не се совпаѓаат."); return; }
    setLoading(true);
    const { error: verErr } = await supabase.auth.verifyOtp({ email: resetEmail.trim(), token: resetCode.trim(), type: "recovery" });
    if (verErr) { setLoading(false); setError("Погрешен или истечен код."); return; }
    const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (updErr) { setError("Настана грешка при менувањето на лозинката."); return; }
    // Сесијата е веќе активна — ClientFlow автоматски продолжува понатаму.
  };

  const signup = async () => {
    setError("");
    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !email.trim()) { setError("Пополни ги сите полиња."); return; }
    if (password.length < 6) { setError("Лозинката мора да има барем 6 карактери."); return; }
    if (password !== confirmPassword) { setError("Лозинките не се совпаѓаат."); return; }
    setLoading(true);

    const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password });
    if (err) {
      console.error("SIGNUP ERROR:", err);
      setLoading(false);
      setError(err.message.includes("already") ? "Веќе постои профил со таа е-пошта." : `Грешка: ${err.message}`);
      return;
    }

    // Ако е-поштата бара потврда (сеуште вклучено во Supabase), нема активна сесија —
    // во тој случај корисникот треба прво да ја потврди е-поштата пред да продолжи.
    if (!data.session) {
      setLoading(false);
      setError("Профилот е креиран, но е-поштата бара потврда пред најава. Провери го инбоксот, или исклучи ја потврдата на е-пошта во Supabase поставките.");
      return;
    }

    const { data: client, error: insErr } = await supabase
      .from("clients")
      .insert({
        auth_user_id: data.user.id,
        name: `${firstName.trim()} ${lastName.trim()}`,
        phone: phone.trim(),
        email: email.trim(),
        avatar_url: avatarUrl,
      })
      .select()
      .single();

    setLoading(false);

    if (insErr) {
      console.error("CLIENT INSERT ERROR:", insErr);
      setError("Настана грешка при креирање на профилот.");
      return;
    }

    // ClientFlow ќе ја преземе сесијата преку onAuthStateChange и веднаш ќе продолжи во апликацијата.
  };

  if (mode === "choose") {
    return (
      <div className="min-h-full bg-[#FDF9F7] flex flex-col px-6 pt-10 pb-8 items-center text-center">
        <button onClick={onBack} className="self-start text-[#8B7A8E] flex items-center gap-1 text-sm mb-6"><ChevronLeft size={16}/>Назад</button>
        <Logo size={26} />
        <h1 className="font-serif text-[#2B1B2E] text-2xl mt-8" style={{ fontWeight: 600 }}>Твојот профил</h1>
        <p className="text-[#8B7A8E] text-sm mt-2">За да закажуваш и да ги гледаш твоите термини.</p>
        <div className="mt-8 w-full flex flex-col gap-3">
          <button onClick={()=>setMode("signup")} className="w-full bg-[#B5566B] text-white rounded-xl py-3.5 text-sm font-medium">Направи нов профил</button>
          <button onClick={()=>setMode("login")} className="w-full bg-white border border-[#EDE3E0] text-[#2B1B2E] rounded-xl py-3.5 text-sm font-medium">Најави се на постоечки</button>
          {/* Google-најава е привремено исклучена — најава/регистрација само со е-пошта и лозинка.
          <GoogleButton onClick={googleSignIn} /> */}
        </div>
      </div>
    );
  }
  if (mode === "login") {
    return (
      <div className="min-h-full bg-[#FDF9F7] flex flex-col px-6 pt-10 pb-8">
        <button onClick={()=>setMode("choose")} className="text-[#8B7A8E] flex items-center gap-1 text-sm mb-6"><ChevronLeft size={16}/>Назад</button>
        <h1 className="font-serif text-[#2B1B2E] text-2xl" style={{ fontWeight: 600 }}>Најави се</h1>
        <div className="mt-6 flex flex-col gap-3">
          <TextField value={email} onChange={e=>setEmail(e.target.value)} placeholder="Е-пошта" type="email" />
          <TextField value={password} onChange={e=>setPassword(e.target.value)} placeholder="Лозинка" type="password" />
          {error && <p className="text-[#B5566B] text-xs">{error}</p>}
          <button type="button" onClick={()=>{ setResetEmail(email); setError(""); setMode("forgot"); }} className="self-end text-[#B5566B] text-xs font-medium">Заборавена лозинка?</button>
          <button disabled={loading} onClick={login} className="mt-1 bg-[#B5566B] text-white rounded-xl py-3.5 text-sm font-medium flex items-center justify-center gap-2">
            {loading && <Loader2 size={15} className="animate-spin" />} Најави се
          </button>
          {/* Google-најава е привремено исклучена — најава/регистрација само со е-пошта и лозинка.
          <GoogleButton onClick={googleSignIn} /> */}
        </div>
      </div>
    );
  }
  if (mode === "forgot") {
    return (
      <div className="min-h-full bg-[#FDF9F7] flex flex-col px-6 pt-10 pb-8">
        <button onClick={()=>setMode("login")} className="text-[#8B7A8E] flex items-center gap-1 text-sm mb-6"><ChevronLeft size={16}/>Назад</button>
        <h1 className="font-serif text-[#2B1B2E] text-2xl" style={{ fontWeight: 600 }}>Ресетирај лозинка</h1>
        <p className="text-[#8B7A8E] text-sm mt-2">Внеси ја е-поштата и ќе ти испратиме код за да поставиш нова лозинка.</p>
        <div className="mt-6 flex flex-col gap-3">
          <TextField value={resetEmail} onChange={e=>setResetEmail(e.target.value)} placeholder="Е-пошта" type="email" />
          {error && <p className="text-[#B5566B] text-xs">{error}</p>}
          <button disabled={loading} onClick={sendResetCode} className="mt-1 bg-[#B5566B] text-white rounded-xl py-3.5 text-sm font-medium flex items-center justify-center gap-2">
            {loading && <Loader2 size={15} className="animate-spin" />} Испрати код
          </button>
        </div>
      </div>
    );
  }
  if (mode === "reset") {
    return (
      <div className="min-h-full bg-[#FDF9F7] flex flex-col px-6 pt-10 pb-8">
        <button onClick={()=>setMode("forgot")} className="text-[#8B7A8E] flex items-center gap-1 text-sm mb-6"><ChevronLeft size={16}/>Назад</button>
        <h1 className="font-serif text-[#2B1B2E] text-2xl" style={{ fontWeight: 600 }}>Нова лозинка</h1>
        <p className="text-[#8B7A8E] text-sm mt-2">Испративме код од 8 бројки на {resetEmail}.</p>
        <div className="mt-6 flex flex-col gap-3">
          <TextField value={resetCode} onChange={e=>setResetCode(e.target.value)} placeholder="Код од е-поштата" inputMode="numeric" maxLength={8} />
          <TextField value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Нова лозинка" type="password" />
          <TextField value={confirmNewPassword} onChange={e=>setConfirmNewPassword(e.target.value)} placeholder="Потврди нова лозинка" type="password" />
          {error && <p className="text-[#B5566B] text-xs">{error}</p>}
          <button disabled={loading} onClick={confirmReset} className="mt-1 bg-[#B5566B] text-white rounded-xl py-3.5 text-sm font-medium flex items-center justify-center gap-2">
            {loading && <Loader2 size={15} className="animate-spin" />} Постави лозинка
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-full bg-[#FDF9F7] flex flex-col px-6 pt-10 pb-8">
      <button onClick={()=>setMode("choose")} className="text-[#8B7A8E] flex items-center gap-1 text-sm mb-6"><ChevronLeft size={16}/>Назад</button>
      <h1 className="font-serif text-[#2B1B2E] text-2xl mb-5" style={{ fontWeight: 600 }}>Нов профил</h1>
      <AvatarPicker url={avatarUrl} onChange={setAvatarUrl} />
      <div className="mt-5 flex flex-col gap-3">
        <TextField value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="Име" />
        <TextField value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Презиме" />
        <TextField value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Телефон" />
        <TextField value={email} onChange={e=>setEmail(e.target.value)} placeholder="Е-пошта" type="email" />
        <TextField value={password} onChange={e=>setPassword(e.target.value)} placeholder="Лозинка" type="password" />
        <TextField value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Потврди лозинка" type="password" />
        {error && <p className="text-[#B5566B] text-xs">{error}</p>}
        <button disabled={loading} onClick={signup} className="mt-2 bg-[#B5566B] text-white rounded-xl py-3.5 text-sm font-medium flex items-center justify-center gap-2">
          {loading && <Loader2 size={15} className="animate-spin" />} Продолжи
        </button>
        {/* Google-најава е привремено исклучена — најава/регистрација само со е-пошта и лозинка.
        <GoogleButton onClick={googleSignIn} /> */}
      </div>
    </div>
  );
}

function CompleteClientProfile({ session, onDone, onBack }) {
  const meta = session.user.user_metadata || {};
  const [avatarUrl, setAvatarUrl] = useState(meta.avatar_url || null);
  const [name, setName] = useState(meta.full_name || meta.name || "");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!name.trim() || !phone.trim()) { setError("Пополни ги сите полиња."); return; }
    setLoading(true);
    const { data, error: err } = await supabase.from("clients").insert({
      auth_user_id: session.user.id, name: name.trim(), phone: phone.trim(), email: session.user.email, avatar_url: avatarUrl,
    }).select().single();
    setLoading(false);
    if (err) { console.error(err); setError("Настана грешка, обиди се повторно."); return; }
    onDone(data);
  };

  return (
    <div className="min-h-full bg-[#FDF9F7] flex flex-col px-6 pt-10 pb-8">
      <button onClick={()=>{ supabase.auth.signOut(); onBack(); }} className="text-[#8B7A8E] flex items-center gap-1 text-sm mb-6"><ChevronLeft size={16}/>Назад</button>
      <h1 className="font-serif text-[#2B1B2E] text-2xl mb-1" style={{ fontWeight: 600 }}>Уште малку...</h1>
      <p className="text-[#8B7A8E] text-sm mb-5">Дополни го профилот за да продолжиш.</p>
      <AvatarPicker url={avatarUrl} onChange={setAvatarUrl} />
      <div className="mt-5 flex flex-col gap-3">
        <TextField value={name} onChange={e=>setName(e.target.value)} placeholder="Име и презиме" />
        <TextField value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Телефон" />
        {error && <p className="text-[#B5566B] text-xs">{error}</p>}
        <button disabled={loading} onClick={save} className="mt-2 bg-[#B5566B] text-white rounded-xl py-3.5 text-sm font-medium flex items-center justify-center gap-2">
          {loading && <Loader2 size={15} className="animate-spin" />} Готово
        </button>
      </div>
    </div>
  );
}

function ChangePasswordSection() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const changePassword = async () => {
    setMsg("");
    if (newPassword.length < 6) { setMsg("Лозинката мора да има барем 6 карактери."); return; }
    if (newPassword !== confirmNewPassword) { setMsg("Лозинките не се совпаѓаат."); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) { setMsg("Настана грешка, обиди се повторно."); return; }
    setNewPassword(""); setConfirmNewPassword("");
    setMsg("Лозинката е успешно сменета.");
  };

  return (
    <div className="mt-1 pt-4 border-t border-[#EDE3E0] flex flex-col gap-3">
      <div className="text-[#6B5A6E] text-xs font-medium uppercase tracking-wide">Смени лозинка</div>
      <TextField value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Нова лозинка" type="password" />
      <TextField value={confirmNewPassword} onChange={e=>setConfirmNewPassword(e.target.value)} placeholder="Потврди нова лозинка" type="password" />
      {msg && <p className="text-[#B5566B] text-xs">{msg}</p>}
      <button disabled={saving} onClick={changePassword} className="py-3 rounded-xl border border-[#EDE3E0] text-[#2B1B2E] text-sm font-medium flex items-center justify-center gap-2">
        {saving && <Loader2 size={15} className="animate-spin"/>} Смени лозинка
      </button>
    </div>
  );
}

function ClientProfile({ client, onSaved, onLogout }) {
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone);
  const [avatarUrl, setAvatarUrl] = useState(client.avatar_url || null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("clients").update({ name: name.trim(), phone: phone.trim(), avatar_url: avatarUrl }).eq("id", client.id);
    setSaving(false);
    if (!error) onSaved({ ...client, name: name.trim(), phone: phone.trim(), avatar_url: avatarUrl });
  };
  return (
    <div className="flex flex-col gap-4">
      <AvatarPicker url={avatarUrl} onChange={setAvatarUrl} />
      <TextField value={name} onChange={e=>setName(e.target.value)} placeholder="Име" />
      <TextField value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Телефон" />
      <TextField value={client.email || ""} disabled placeholder="Е-пошта" className="opacity-60 cursor-not-allowed" />
      <button disabled={saving} onClick={save} className="bg-[#B5566B] text-white rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2">
        {saving && <Loader2 size={15} className="animate-spin"/>} Зачувај промени
      </button>
      <ChangePasswordSection />
      <button onClick={onLogout} className="mt-2 py-3 rounded-xl border border-[#EDE3E0] text-[#8B7A8E] text-sm font-medium">Одјави се</button>
    </div>
  );
}

// ---------------- Rating modal ----------------
function RatingModal({ booking, onDone }) {
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState("");
  const [saving, setSaving] = useState(false);

  const finishAndRecompute = async () => {
    const { data } = await supabase.from("bookings").select("rating").eq("provider_id", booking.provider_id).gt("rating", 0);
    if (data && data.length) {
      const avg = data.reduce((s, r) => s + r.rating, 0) / data.length;
      await supabase.from("providers").update({ rating: Math.round(avg * 10) / 10 }).eq("id", booking.provider_id);
    }
  };

  const submit = async () => {
    if (stars === 0) return;
    setSaving(true);
    await supabase.from("bookings").update({ rating: stars, review: review.trim() || null }).eq("id", booking.id);
    await finishAndRecompute();
    setSaving(false);
    onDone();
  };

  const skip = async () => {
    setSaving(true);
    await supabase.from("bookings").update({ rating: 0 }).eq("id", booking.id);
    setSaving(false);
    onDone();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-6 pb-6 sm:pb-0">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
        <h3 className="font-serif text-[#2B1B2E] text-lg" style={{fontWeight:600}}>Какво беше твоето искуство?</h3>
        <p className="text-[#8B7A8E] text-sm mt-1 mb-4">Кај {booking.provider_salon || "Artist-от"} — {booking.service_name}</p>
        <div className="flex gap-1.5 justify-center mb-4">
          {[1,2,3,4,5].map(n => (
            <button key={n} onClick={()=>setStars(n)}>
              <Star size={30} className={n <= stars ? "fill-[#B5566B] text-[#B5566B]" : "text-[#DDD2D5]"} />
            </button>
          ))}
        </div>
        <textarea value={review} onChange={e=>setReview(e.target.value)} placeholder="Напиши коментар (опционално)" rows={3}
          className="w-full bg-[#FDF9F7] border border-[#EDE3E0] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#B5566B] resize-none" />
        <div className="flex gap-2 mt-4">
          <button disabled={saving} onClick={skip} className="flex-1 py-3 rounded-xl border border-[#EDE3E0] text-[#8B7A8E] text-sm font-medium">Прескокни</button>
          <button disabled={stars===0 || saving} onClick={submit} className="flex-1 py-3 rounded-xl bg-[#B5566B] disabled:opacity-40 text-white text-sm font-medium flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin"/>} Испрати
          </button>
        </div>
      </div>
    </div>
  );
}

function ProviderProfileModal({ provider, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-6 pb-6 sm:pb-0">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[80vh] overflow-y-auto">
        <div className="flex items-center gap-3">
          <Avatar url={provider.avatar_url} name={provider.name} size={56} />
          <div>
            <div className="font-serif text-[#2B1B2E] text-lg" style={{fontWeight:600}}>{provider.salon}</div>
            <div className="text-[#8B7A8E] text-xs">{provider.name} · {provider.city}</div>
            <div className="flex items-center gap-1 text-xs text-[#2B1B2E] mt-0.5"><Star size={11} className="fill-[#B5566B] text-[#B5566B]"/>{provider.rating}</div>
          </div>
        </div>
        {provider.bio && <p className="text-[#6B5A6E] text-sm mt-4 leading-relaxed">{provider.bio}</p>}
        <div className="flex flex-col gap-2 mt-4">
          {provider.phone && (
            <div className="flex items-center gap-2 text-sm text-[#2B1B2E]"><Phone size={14} className="text-[#B5566B]"/>{provider.phone}</div>
          )}
          {provider.address && (
            <div className="flex items-center gap-2 text-sm text-[#2B1B2E]"><MapPin size={14} className="text-[#B5566B]"/>{provider.address}</div>
          )}
        </div>
        <button onClick={onClose} className="mt-6 w-full py-3 rounded-xl border border-[#EDE3E0] text-[#8B7A8E] text-sm font-medium">Затвори</button>
      </div>
    </div>
  );
}

function ProviderReviews({ providerId }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.from("bookings").select("client_name, rating, review, created_at").eq("provider_id", providerId).gt("rating", 0).order("created_at", { ascending: false }).limit(6)
      .then(({ data, error }) => { if (error) console.error(error); setReviews(data || []); setLoading(false); });
  }, [providerId]);
  if (loading || reviews.length === 0) return null;
  return (
    <div className="mt-6">
      <div className="text-[#6B5A6E] text-xs font-medium mb-2 uppercase tracking-wide">Оценки ({reviews.length})</div>
      <div className="flex flex-col gap-2">
        {reviews.map((r, i) => (
          <div key={i} className="bg-white border border-[#EDE3E0] rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#2B1B2E]">{r.client_name}</span>
              <div className="flex">{Array.from({length:5}).map((_,idx)=>(<Star key={idx} size={11} className={idx < r.rating ? "fill-[#B5566B] text-[#B5566B]" : "text-[#DDD2D5]"} />))}</div>
            </div>
            {r.review && <p className="text-[#8B7A8E] text-xs mt-1">{r.review}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Client home ----------------
function ClientHomeScreen({ client, goSearch, goBookings }) {
  const [next, setNext] = useState(undefined);
  useEffect(() => {
    supabase.from("bookings").select("*").eq("client_id", client.id).eq("status", "accepted").gte("date", todayStr()).order("date").order("time").limit(1)
      .then(({ data }) => setNext((data && data[0]) || null));
  }, [client.id]);

  return (
    <div className="px-6 py-4 flex flex-col gap-4">
      <div className="bg-white border border-[#EDE3E0] rounded-2xl p-5">
        <div className="text-[#8B7A8E] text-xs">Здраво,</div>
        <div className="font-serif text-[#2B1B2E] text-xl mt-0.5" style={{fontWeight:600}}>{client.name.split(" ")[0]} 👋</div>
        <p className="text-[#8B7A8E] text-sm mt-2">Пронајди Artist за нокти, педикир или масажа блиску до тебе.</p>
      </div>

      {next === undefined ? null : next ? (
        <div className="bg-[#FBEFEF] border border-[#E9C9D0] rounded-2xl p-4">
          <div className="text-[#8A4A5A] text-xs font-medium uppercase tracking-wide mb-1">Следен термин</div>
          <div className="text-[#2B1B2E] text-sm font-medium">{next.provider_salon} · {next.service_name}</div>
          <div className="text-[#8B7A8E] text-xs mt-1 flex items-center gap-3">
            <span className="flex items-center gap-1"><Calendar size={11}/>{next.day}</span>
            <span className="flex items-center gap-1"><Clock size={11}/>{next.time}</span>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={goSearch} className="bg-white border border-[#EDE3E0] rounded-2xl p-4 text-left hover:border-[#B5566B] transition-colors">
          <Search size={18} className="text-[#B5566B] mb-2" />
          <div className="text-[#2B1B2E] text-sm font-medium">Пребарај</div>
          <div className="text-[#8B7A8E] text-xs mt-0.5">Најди термин</div>
        </button>
        <button onClick={goBookings} className="bg-white border border-[#EDE3E0] rounded-2xl p-4 text-left hover:border-[#B5566B] transition-colors">
          <Calendar size={18} className="text-[#4A6B54] mb-2" />
          <div className="text-[#2B1B2E] text-sm font-medium">Мои термини</div>
          <div className="text-[#8B7A8E] text-xs mt-0.5">Провери статус</div>
        </button>
      </div>
    </div>
  );
}

function ClientHome({ client, onHome, onLogout }) {
  const [view, setViewRaw] = useState(() => localStorage.getItem("termin-client-view") || "home");
  const setView = (v) => { localStorage.setItem("termin-client-view", v); setViewRaw(v); };
  const [clientData, setClientData] = useState(client);
  const [ratingQueue, setRatingQueue] = useState([]);

  useEffect(() => {
    supabase.from("bookings").select("*").eq("client_id", clientData.id).eq("status", "accepted").is("rating", null)
      .then(({ data }) => setRatingQueue((data || []).filter(needsRating)));
  }, [clientData.id]);

  if (view === "profile") {
    return (
      <div className="min-h-full bg-[#FDF9F7] flex flex-col px-6 pt-10 pb-8">
        <button onClick={()=>setView("home")} className="text-[#8B7A8E] flex items-center gap-1 text-sm mb-6"><ChevronLeft size={16}/>Назад</button>
        <h1 className="font-serif text-[#2B1B2E] text-2xl mb-6" style={{fontWeight:600}}>Профил</h1>
        <ClientProfile client={clientData} onSaved={setClientData} onLogout={onLogout} />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#FDF9F7] flex flex-col">
      <div className="px-6 pt-10 pb-3 flex items-center justify-between">
        <button onClick={()=>setView("home")} className="text-[#8B7A8E] p-1"><Home size={19}/></button>
        <Avatar url={clientData.avatar_url} name={clientData.name} size={30} />
        <button onClick={()=>setView("profile")} className="text-[#8B7A8E] p-1"><User size={19}/></button>
      </div>
      <div className="px-6 flex gap-1.5 bg-[#F2EAE7] rounded-xl p-1">
        <button onClick={()=>setView("home")} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${view==="home" ? "bg-white text-[#2B1B2E] shadow-sm" : "text-[#8B7A8E]"}`}>Дома</button>
        <button onClick={()=>setView("search")} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${view==="search" ? "bg-white text-[#2B1B2E] shadow-sm" : "text-[#8B7A8E]"}`}>Пребарувај</button>
        <button onClick={()=>setView("mine")} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${view==="mine" ? "bg-white text-[#2B1B2E] shadow-sm" : "text-[#8B7A8E]"}`}>Мои термини</button>
      </div>
      <div className="flex-1">
        {view === "home" && <ClientHomeScreen client={clientData} goSearch={()=>setView("search")} goBookings={()=>setView("mine")} />}
        {view === "search" && <SearchBook client={clientData} />}
        {view === "mine" && <MyBookings client={clientData} />}
      </div>

      {ratingQueue[0] && (
        <RatingModal booking={ratingQueue[0]} onDone={() => setRatingQueue(q => q.slice(1))} />
      )}
    </div>
  );
}

function MyBookings({ client }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    supabase.from("bookings").select("*").eq("client_id", client.id).order("created_at", { ascending: false })
      .then(({ data, error }) => { if (error) console.error(error); setBookings(data || []); setLoading(false); });
  };
  useEffect(() => {
    load();
    const channel = supabase
      .channel(`client-bookings-${client.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `client_id=eq.${client.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [client.id]);

  const cancel = async (booking) => {
    setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: "cancelled" } : b));
    const { error } = await supabase.from("bookings").update({ status: "cancelled", provider_notified: false, cancelled_by: "client" }).eq("id", booking.id);
    if (error) { console.error(error); load(); return; }
    if (booking.availability_id) await supabase.from("availability").update({ status: "free" }).eq("id", booking.availability_id);
  };

  if (loading) return <Spinner />;

  return (
    <div className="px-6 py-4 flex flex-col gap-3">
      {bookings.length === 0 && <p className="text-[#B3A5B5] text-sm text-center pt-8">Сеуште немаш закажано ништо.</p>}
      {bookings.map(b => (
        <div key={b.id} className="bg-white border border-[#EDE3E0] rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[#2B1B2E] text-sm font-medium">{catInfo(b.category).icon} {b.service_name}</div>
              <div className="text-[#8B7A8E] text-xs mt-0.5 flex items-center gap-3">
                <span className="flex items-center gap-1"><Calendar size={11}/>{b.day}</span>
                <span className="flex items-center gap-1"><Clock size={11}/>{b.time}</span>
              </div>
            </div>
            <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${STATUS_COLOR[b.status]}`}>{STATUS_LABEL[b.status]}</span>
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="text-[#2B1B2E] text-sm font-medium">{fmt(b.price)}</span>
            {(b.status === "pending" || b.status === "accepted") && (
              <button onClick={()=>cancel(b)} className="text-[#B5566B] text-xs font-medium">Откажи</button>
            )}
          </div>
          {b.status === "cancelled" && b.cancelled_by === "provider" && (
            <p className="text-[#8A4A4A] text-xs mt-2 pt-2 border-t border-[#F2EAE7]">
              Откажано од Artist-от{b.cancel_reason ? `: ${b.cancel_reason}` : "."}
            </p>
          )}
          {b.rating > 0 && (
            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-[#F2EAE7]">
              {Array.from({length:5}).map((_,idx)=>(<Star key={idx} size={11} className={idx < b.rating ? "fill-[#B5566B] text-[#B5566B]" : "text-[#DDD2D5]"} />))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SearchByDate({ city, category, client, onPicked }) {
  const [date, setDate] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date) { setResults(null); return; }
    setLoading(true);
    (async () => {
      const { data: availRows, error: availErr } = await supabase.from("availability").select("provider_id").eq("date", date).eq("status", "free");
      if (availErr) { console.error(availErr); setResults([]); setLoading(false); return; }
      const ids = [...new Set((availRows || []).map(a => a.provider_id))];
      if (ids.length === 0) { setResults([]); setLoading(false); return; }
      let q = supabase.from("providers").select("*").in("id", ids).eq("available", true);
      if (city) q = q.eq("city", city);
      const { data: provs, error: provErr } = await q;
      if (provErr) console.error(provErr);
      const filtered = (provs || []).filter(p => !category || (p.services || []).some(s => s.category === category));
      setResults(filtered);
      setLoading(false);
    })();
  }, [date, city, category]);

  return (
    <div className="px-6 pt-4 pb-8">
      <MonthCalendar selectedDate={date} onSelect={setDate} />
      {date && (
        <div className="mt-4">
          <div className="text-[#6B5A6E] text-xs font-medium mb-2 uppercase tracking-wide">Слободни на {formatDate(date)}</div>
          {loading || !results ? <Spinner /> : results.length === 0 ? (
            <p className="text-[#B3A5B5] text-sm text-center pt-4">Никој {city ? `во ${city} ` : ""}нема слободен термин на овој датум{category ? " за таа услуга" : ""}.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {results.map(p => {
                const list = category ? (p.services||[]).filter(s=>s.category===category) : (p.services||[]);
                const min = list.length ? Math.min(...list.map(s=>s.price)) : null;
                return (
                  <button key={p.id} onClick={()=>onPicked(p, date)} className="text-left bg-white border border-[#EDE3E0] rounded-2xl p-4 flex items-center gap-3 hover:border-[#B5566B] transition-colors">
                    <Avatar url={p.avatar_url} name={p.name} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[#2B1B2E] font-medium text-sm truncate">{p.salon}</div>
                      <div className="text-[#8B7A8E] text-xs truncate">{p.name} · {p.city}</div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <div className="flex items-center gap-1 text-xs text-[#2B1B2E]"><Star size={12} className="fill-[#B5566B] text-[#B5566B]"/>{p.rating}</div>
                      {min != null && <div className="text-[#8B7A8E] text-xs mt-0.5">од {fmt(min)}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchBook({ client }) {
  const [mode, setMode] = useState("provider"); // provider | date
  const [city, setCity] = useState("");
  const [category, setCategory] = useState(null);
  const [query, setQuery] = useState("");
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [pickedDate, setPickedDate] = useState(null);
  const [booked, setBooked] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    let q = supabase.from("providers").select("*").eq("available", true);
    if (city) q = q.eq("city", city);
    q.then(({ data, error }) => { if (!active) return; if (error) console.error(error); setProviders(data || []); setLoading(false); });
    return () => { active = false; };
  }, [city]);

  const results = useMemo(() => {
    return providers
      .filter(p => !category || (p.services || []).some(s => s.category === category))
      .filter(p => !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.salon.toLowerCase().includes(query.toLowerCase()));
  }, [providers, category, query]);

  if (booked) {
    return (
      <div className="min-h-full bg-[#FDF9F7] flex flex-col px-6 pt-6 pb-8 items-center text-center">
        <div className="w-16 h-16 rounded-full bg-[#DCE6DE] flex items-center justify-center mb-5">
          <Check size={28} className="text-[#4A6B54]" />
        </div>
        <h2 className="font-serif text-[#2B1B2E] text-2xl" style={{ fontWeight: 600 }}>Барањето е испратено</h2>
        <p className="text-[#8B7A8E] mt-2 text-sm">{booked.salon} · {booked.serviceName}<br/>{booked.day}, {booked.time}</p>
        <p className="text-[#B3A5B5] text-xs mt-2">Провери во "Мои термини" за статусот.</p>
        <div className="mt-5 bg-white border border-[#EDE3E0] rounded-2xl px-5 py-4 w-full">
          <div className="flex justify-between text-sm text-[#6B5A6E]"><span>Цена</span><span className="text-[#2B1B2E] font-medium">{fmt(booked.price)}</span></div>
        </div>
        <button onClick={()=>{setBooked(null); setSelected(null);}} className="mt-8 text-[#B5566B] text-sm font-medium">Пребарувај понатаму</button>
      </div>
    );
  }
  if (selected) {
    return <BookingDetail provider={selected} client={client} onBack={() => { setSelected(null); setPickedDate(null); }} onConfirm={setBooked} preselectCategory={category} preselectDate={pickedDate} />;
  }

  return (
    <div className="min-h-full bg-[#FDF9F7] flex flex-col">
      <div className="px-6 pt-4 pb-4">
        <div className="flex items-center gap-2 bg-white border border-[#EDE3E0] rounded-xl px-3 py-2.5 mb-3">
          <Search size={16} className="text-[#B3A5B5]" />
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Име на салон или Artist..."
            className="flex-1 outline-none text-sm text-[#2B1B2E] placeholder-[#B3A5B5] bg-transparent" />
        </div>
        <div className="flex items-center gap-2">
          <MapPin size={15} className="text-[#B5566B] shrink-0" />
          <div className="flex-1"><CityCombobox value={city} onChange={setCity} /></div>
        </div>
        <div className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button onClick={()=>setCategory(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${!category ? "bg-[#B5566B] text-white border-[#B5566B]" : "bg-white text-[#6B5A6E] border-[#EDE3E0]"}`}>Сите услуги</button>
          {CATEGORIES.map(s => (
            <button key={s.id} onClick={()=>setCategory(s.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${category===s.id ? "bg-[#B5566B] text-white border-[#B5566B]" : "bg-white text-[#6B5A6E] border-[#EDE3E0]"}`}>{s.icon} {s.name}</button>
          ))}
        </div>
        <div className="mt-3 flex gap-1.5 bg-[#F2EAE7] rounded-xl p-1">
          <button onClick={()=>setMode("provider")} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${mode==="provider" ? "bg-white text-[#2B1B2E] shadow-sm" : "text-[#8B7A8E]"}`}>По Artist</button>
          <button onClick={()=>setMode("date")} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${mode==="date" ? "bg-white text-[#2B1B2E] shadow-sm" : "text-[#8B7A8E]"}`}>По датум</button>
        </div>
      </div>
      {mode === "date" ? (
        <SearchByDate city={city} category={category} client={client} onPicked={(p, d)=>{ setSelected(p); setPickedDate(d); }} />
      ) : loading ? <Spinner /> : (
        <div className="flex-1 px-6 pb-8 flex flex-col gap-3">
          {results.length === 0 && <p className="text-[#B3A5B5] text-sm text-center pt-8">Нема сеуште регистрирано некој {city ? `во ${city} ` : ""}за овој филтер.</p>}
          {results.map(p => {
            const list = category ? (p.services||[]).filter(s=>s.category===category) : (p.services||[]);
            const min = list.length ? Math.min(...list.map(s=>s.price)) : null;
            return (
              <button key={p.id} onClick={()=>setSelected(p)} className="text-left bg-white border border-[#EDE3E0] rounded-2xl p-4 flex items-center gap-3 hover:border-[#B5566B] transition-colors">
                <Avatar url={p.avatar_url} name={p.name} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="text-[#2B1B2E] font-medium text-sm truncate">{p.salon}</div>
                  <div className="text-[#8B7A8E] text-xs truncate">{p.name} · {p.city}</div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <div className="flex items-center gap-1 text-xs text-[#2B1B2E]"><Star size={12} className="fill-[#B5566B] text-[#B5566B]"/>{p.rating}</div>
                  {min != null && <div className="text-[#8B7A8E] text-xs mt-0.5">од {fmt(min)}</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BookingDetail({ provider, client, onBack, onConfirm, preselectCategory, preselectDate }) {
  const services = provider.services || [];
  const filtered = preselectCategory ? services.filter(s=>s.category===preselectCategory) : services;
  const [serviceId, setServiceId] = useState((filtered[0] || services[0])?.id);
  const [avail, setAvail] = useState([]);
  const [loadingAvail, setLoadingAvail] = useState(true);
  const [date, setDate] = useState(preselectDate || null);
  const [slotId, setSlotId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const service = services.find(s => s.id === serviceId);

  useEffect(() => {
    supabase.from("availability").select("*").eq("provider_id", provider.id).eq("status", "free").gte("date", todayStr())
      .order("date").order("time")
      .then(({ data, error }) => {
        if (error) console.error(error);
        setAvail((data || []).filter(a => isFutureSlot(a.date, a.time)));
        setLoadingAvail(false);
      });
  }, [provider.id]);

  const availableDates = useMemo(() => new Set(avail.map(a => a.date)), [avail]);
  const daySlots = avail.filter(a => a.date === date);

  const submit = async () => {
    if (!slotId || !service) return;
    const slot = avail.find(a => a.id === slotId);
    if (!slot) return;
    setSaving(true);
    const { error } = await supabase.from("bookings").insert({
      provider_id: provider.id, client_id: client.id, client_name: client.name, client_phone: client.phone,
      service_id: service.id, service_name: service.name, category: service.category,
      day: formatDate(slot.date), time: slot.time, date: slot.date, price: service.price, status: "pending",
      availability_id: slot.id, provider_salon: provider.salon,
    });
    if (error) { console.error(error); setSaving(false); alert("Настана грешка, обиди се повторно."); return; }
    await supabase.from("availability").update({ status: "booked" }).eq("id", slot.id);
    setSaving(false);
    onConfirm({ salon: provider.salon, serviceName: service.name, day: formatDate(slot.date), time: slot.time, price: service.price });
  };

  return (
    <div className="min-h-full bg-[#FDF9F7] flex flex-col px-6 pt-6 pb-8">
      <button onClick={onBack} className="text-[#8B7A8E] flex items-center gap-1 text-sm mb-4"><ChevronLeft size={16}/>Назад</button>
      <button onClick={()=>setShowProfile(true)} className="flex items-center gap-3 text-left w-full">
        <Avatar url={provider.avatar_url} name={provider.name} size={48} />
        <div className="flex-1">
          <div className="font-serif text-[#2B1B2E] text-lg" style={{ fontWeight: 600 }}>{provider.salon}</div>
          <div className="text-[#8B7A8E] text-xs">{provider.name} · {provider.city}</div>
        </div>
        <Info size={16} className="text-[#B3A5B5]" />
      </button>
      {showProfile && <ProviderProfileModal provider={provider} onClose={()=>setShowProfile(false)} />}

      <div className="mt-6">
        <div className="text-[#6B5A6E] text-xs font-medium mb-2 uppercase tracking-wide">Услуга</div>
        <div className="flex flex-col gap-2">
          {services.length === 0 && <p className="text-[#B3A5B5] text-xs">Овој Artist сеуште нема додадено услуги.</p>}
          {services.map(s => (
            <button key={s.id} onClick={()=>setServiceId(s.id)}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition-colors ${serviceId===s.id ? "border-[#B5566B] bg-[#FBEFEF]" : "border-[#EDE3E0] bg-white"}`}>
              <span className="text-[#2B1B2E]">{catInfo(s.category).icon} {s.name}</span>
              <span className="text-[#8B7A8E] font-medium">{fmt(s.price)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <div className="text-[#6B5A6E] text-xs font-medium mb-2 uppercase tracking-wide">Датум</div>
        {loadingAvail ? <Spinner /> : avail.length === 0 ? (
          <p className="text-[#B3A5B5] text-xs">Овој Artist сеуште нема отворено термини.</p>
        ) : (
          <MonthCalendar selectedDate={date} onSelect={(d)=>{ setDate(d); setSlotId(null); }} availableDates={availableDates} />
        )}
      </div>

      {date && (
        <div className="mt-6">
          <div className="text-[#6B5A6E] text-xs font-medium mb-2 uppercase tracking-wide">Термин · {formatDate(date)}</div>
          <div className="grid grid-cols-4 gap-2">
            {daySlots.map(s => (
              <button key={s.id} onClick={()=>setSlotId(s.id)}
                className={`py-2 rounded-xl text-xs font-medium border ${slotId===s.id ? "bg-[#B5566B] text-white border-[#B5566B]" : "bg-white text-[#6B5A6E] border-[#EDE3E0]"}`}>{s.time}</button>
            ))}
          </div>
        </div>
      )}

      <ProviderPortfolio providerId={provider.id} category={service?.category} />
      <ProviderReviews providerId={provider.id} />

      <div className="mt-auto pt-8">
        <div className="flex items-center justify-between text-sm mb-3">
          <span className="text-[#8B7A8E]">Вкупно</span>
          <span className="text-[#2B1B2E] font-serif text-xl" style={{fontWeight:600}}>{service ? fmt(service.price) : "—"}</span>
        </div>
        <button disabled={!slotId || !service || saving} onClick={submit}
          className="w-full bg-[#B5566B] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-3.5 text-sm font-medium flex items-center justify-center gap-2">
          {saving && <Loader2 size={15} className="animate-spin" />} Испрати барање за термин
        </button>
      </div>
    </div>
  );
}

// ---------------- Provider auth ----------------
function ProviderAuth({ onBack }) {
  const [mode, setMode] = useState("choose"); // choose | login | signup | forgot | reset
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [salon, setSalon] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const login = async () => {
    setError(""); setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) setError("Погрешна е-пошта или лозинка.");
  };

  const sendResetCode = async () => {
    setError("");
    if (!resetEmail.trim()) { setError("Внеси ја е-поштата."); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail.trim());
    setLoading(false);
    if (err) { setError("Настана грешка, обиди се повторно."); return; }
    setMode("reset");
  };

  const confirmReset = async () => {
    setError("");
    if (resetCode.trim().length !== 8) { setError("Внеси го целиот код од 8 бројки."); return; }
    if (newPassword.length < 6) { setError("Лозинката мора да има барем 6 карактери."); return; }
    if (newPassword !== confirmNewPassword) { setError("Лозинките не се совпаѓаат."); return; }
    setLoading(true);
    const { error: verErr } = await supabase.auth.verifyOtp({ email: resetEmail.trim(), token: resetCode.trim(), type: "recovery" });
    if (verErr) { setLoading(false); setError("Погрешен или истечен код."); return; }
    const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (updErr) { setError("Настана грешка при менувањето на лозинката."); return; }
    // Сесијата е веќе активна — ProviderFlow автоматски продолжува понатаму.
  };

  const signup = async () => {
    setError("");
    if (!firstName.trim() || !lastName.trim() || !salon.trim() || !city.trim() || !phone.trim() || !email.trim()) { setError("Пополни ги сите задолжителни полиња."); return; }
    if (password.length < 6) { setError("Лозинката мора да има барем 6 карактери."); return; }
    if (password !== confirmPassword) { setError("Лозинките не се совпаѓаат."); return; }
    setLoading(true);

    const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password });
    if (err) {
      console.error("SIGNUP ERROR:", err);
      setLoading(false);
      setError(err.message.includes("already") ? "Веќе постои профил со таа е-пошта." : `Грешка: ${err.message}`);
      return;
    }

    // Ако е-поштата бара потврда (сеуште вклучено во Supabase), нема активна сесија —
    // во тој случај корисникот треба прво да ја потврди е-поштата пред да продолжи.
    if (!data.session) {
      setLoading(false);
      setError("Профилот е креиран, но е-поштата бара потврда пред најава. Провери го инбоксот, или исклучи ја потврдата на е-пошта во Supabase поставките.");
      return;
    }

    const { data: provider, error: insErr } = await supabase
      .from("providers")
      .insert({
        auth_user_id: data.user.id,
        name: `${firstName.trim()} ${lastName.trim()}`,
        salon: salon.trim(),
        city: city.trim(),
        address: address.trim() || null,
        phone: phone.trim(),
        email: email.trim(),
        bio: bio.trim() || null,
        services: [],
        rating: 5.0,
        available: true,
        avatar_url: avatarUrl,
      })
      .select()
      .single();

    setLoading(false);

    if (insErr) {
      console.error("PROVIDER INSERT ERROR:", insErr);
      setError("Настана грешка при креирање на профилот.");
      return;
    }

    // ProviderFlow ќе го најде профилот преку auth_user_id (onAuthStateChange) и веднаш продолжува.
  };

  if (mode === "choose") {
    return (
      <div className="min-h-full bg-[#FDF9F7] flex flex-col px-6 pt-10 pb-8 items-center text-center">
        <button onClick={onBack} className="self-start text-[#8B7A8E] flex items-center gap-1 text-sm mb-6"><ChevronLeft size={16}/>Назад</button>
        <Logo size={26} />
        <h1 className="font-serif text-[#2B1B2E] text-2xl mt-8" style={{ fontWeight: 600 }}>Профил за давател</h1>
        <div className="mt-8 w-full flex flex-col gap-3">
          <button onClick={()=>setMode("signup")} className="w-full bg-[#B5566B] text-white rounded-xl py-3.5 text-sm font-medium">Направи нов профил</button>
          <button onClick={()=>setMode("login")} className="w-full bg-white border border-[#EDE3E0] text-[#2B1B2E] rounded-xl py-3.5 text-sm font-medium">Најави се на постоечки</button>
          {/* Google-најава е привремено исклучена — најава/регистрација само со е-пошта и лозинка.
          <GoogleButton onClick={googleSignIn} /> */}
        </div>
      </div>
    );
  }
  if (mode === "login") {
    return (
      <div className="min-h-full bg-[#FDF9F7] flex flex-col px-6 pt-10 pb-8">
        <button onClick={()=>setMode("choose")} className="text-[#8B7A8E] flex items-center gap-1 text-sm mb-6"><ChevronLeft size={16}/>Назад</button>
        <h1 className="font-serif text-[#2B1B2E] text-2xl" style={{ fontWeight: 600 }}>Најави се</h1>
        <div className="mt-6 flex flex-col gap-3">
          <TextField value={email} onChange={e=>setEmail(e.target.value)} placeholder="Е-пошта" type="email" />
          <TextField value={password} onChange={e=>setPassword(e.target.value)} placeholder="Лозинка" type="password" />
          {error && <p className="text-[#B5566B] text-xs">{error}</p>}
          <button type="button" onClick={()=>{ setResetEmail(email); setError(""); setMode("forgot"); }} className="self-end text-[#B5566B] text-xs font-medium">Заборавена лозинка?</button>
          <button disabled={loading} onClick={login} className="mt-1 bg-[#B5566B] text-white rounded-xl py-3.5 text-sm font-medium flex items-center justify-center gap-2">
            {loading && <Loader2 size={15} className="animate-spin" />} Најави се
          </button>
          {/* Google-најава е привремено исклучена — најава/регистрација само со е-пошта и лозинка.
          <GoogleButton onClick={googleSignIn} /> */}
        </div>
      </div>
    );
  }
  if (mode === "forgot") {
    return (
      <div className="min-h-full bg-[#FDF9F7] flex flex-col px-6 pt-10 pb-8">
        <button onClick={()=>setMode("login")} className="text-[#8B7A8E] flex items-center gap-1 text-sm mb-6"><ChevronLeft size={16}/>Назад</button>
        <h1 className="font-serif text-[#2B1B2E] text-2xl" style={{ fontWeight: 600 }}>Ресетирај лозинка</h1>
        <p className="text-[#8B7A8E] text-sm mt-2">Внеси ја е-поштата и ќе ти испратиме код за да поставиш нова лозинка.</p>
        <div className="mt-6 flex flex-col gap-3">
          <TextField value={resetEmail} onChange={e=>setResetEmail(e.target.value)} placeholder="Е-пошта" type="email" />
          {error && <p className="text-[#B5566B] text-xs">{error}</p>}
          <button disabled={loading} onClick={sendResetCode} className="mt-1 bg-[#B5566B] text-white rounded-xl py-3.5 text-sm font-medium flex items-center justify-center gap-2">
            {loading && <Loader2 size={15} className="animate-spin" />} Испрати код
          </button>
        </div>
      </div>
    );
  }
  if (mode === "reset") {
    return (
      <div className="min-h-full bg-[#FDF9F7] flex flex-col px-6 pt-10 pb-8">
        <button onClick={()=>setMode("forgot")} className="text-[#8B7A8E] flex items-center gap-1 text-sm mb-6"><ChevronLeft size={16}/>Назад</button>
        <h1 className="font-serif text-[#2B1B2E] text-2xl" style={{ fontWeight: 600 }}>Нова лозинка</h1>
        <p className="text-[#8B7A8E] text-sm mt-2">Испративме код од 8 бројки на {resetEmail}.</p>
        <div className="mt-6 flex flex-col gap-3">
          <TextField value={resetCode} onChange={e=>setResetCode(e.target.value)} placeholder="Код од е-поштата" inputMode="numeric" maxLength={8} />
          <TextField value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Нова лозинка" type="password" />
          <TextField value={confirmNewPassword} onChange={e=>setConfirmNewPassword(e.target.value)} placeholder="Потврди нова лозинка" type="password" />
          {error && <p className="text-[#B5566B] text-xs">{error}</p>}
          <button disabled={loading} onClick={confirmReset} className="mt-1 bg-[#B5566B] text-white rounded-xl py-3.5 text-sm font-medium flex items-center justify-center gap-2">
            {loading && <Loader2 size={15} className="animate-spin" />} Постави лозинка
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-full bg-[#FDF9F7] flex flex-col px-6 pt-10 pb-8">
      <button onClick={()=>setMode("choose")} className="text-[#8B7A8E] flex items-center gap-1 text-sm mb-6"><ChevronLeft size={16}/>Назад</button>
      <h1 className="font-serif text-[#2B1B2E] text-2xl mb-5" style={{ fontWeight: 600 }}>Нов профил</h1>
      <AvatarPicker url={avatarUrl} onChange={setAvatarUrl} />
      <div className="mt-5 flex flex-col gap-3">
        <TextField value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="Име" />
        <TextField value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Презиме" />
        <TextField value={salon} onChange={e=>setSalon(e.target.value)} placeholder="Име на салон/бренд" />
        <CityCombobox value={city} onChange={setCity} placeholder="Град" />
        <TextField value={address} onChange={e=>setAddress(e.target.value)} placeholder="Адреса (точна локација)" />
        <TextField value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Телефон" />
        <TextField value={email} onChange={e=>setEmail(e.target.value)} placeholder="Е-пошта" type="email" />
        <textarea value={bio} onChange={e=>setBio(e.target.value)} placeholder="Кратко за тебе (опционално)" rows={3}
          className="bg-white border border-[#EDE3E0] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#B5566B] resize-none" />
        <TextField value={password} onChange={e=>setPassword(e.target.value)} placeholder="Лозинка" type="password" />
        <TextField value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Потврди лозинка" type="password" />
        {error && <p className="text-[#B5566B] text-xs">{error}</p>}
        <button disabled={loading} onClick={signup} className="mt-2 bg-[#B5566B] text-white rounded-xl py-3.5 text-sm font-medium flex items-center justify-center gap-2">
          {loading && <Loader2 size={15} className="animate-spin" />} Продолжи
        </button>
        {/* Google-најава е привремено исклучена — најава/регистрација само со е-пошта и лозинка.
        <GoogleButton onClick={googleSignIn} /> */}
      </div>
    </div>
  );
}

function CompleteProviderProfile({ session, onDone, onBack }) {
  const meta = session.user.user_metadata || {};
  const [avatarUrl, setAvatarUrl] = useState(meta.avatar_url || null);
  const [name, setName] = useState(meta.full_name || meta.name || "");
  const [salon, setSalon] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!name.trim() || !salon.trim() || !city.trim() || !phone.trim()) { setError("Пополни ги задолжителните полиња."); return; }
    setLoading(true);
    const { data, error: err } = await supabase.from("providers").insert({
      auth_user_id: session.user.id, name: name.trim(), salon: salon.trim(), city: city.trim(),
      address: address.trim() || null, phone: phone.trim(), email: session.user.email, bio: bio.trim() || null,
      services: [], rating: 5.0, available: true, avatar_url: avatarUrl,
    }).select().single();
    setLoading(false);
    if (err) { console.error(err); setError("Настана грешка, обиди се повторно."); return; }
    onDone(data);
  };

  return (
    <div className="min-h-full bg-[#FDF9F7] flex flex-col px-6 pt-10 pb-8">
      <button onClick={()=>{ supabase.auth.signOut(); onBack(); }} className="text-[#8B7A8E] flex items-center gap-1 text-sm mb-6"><ChevronLeft size={16}/>Назад</button>
      <h1 className="font-serif text-[#2B1B2E] text-2xl mb-1" style={{ fontWeight: 600 }}>Уште малку...</h1>
      <p className="text-[#8B7A8E] text-sm mb-5">Дополни го профилот за да продолжиш.</p>
      <AvatarPicker url={avatarUrl} onChange={setAvatarUrl} />
      <div className="mt-5 flex flex-col gap-3">
        <TextField value={name} onChange={e=>setName(e.target.value)} placeholder="Име и презиме" />
        <TextField value={salon} onChange={e=>setSalon(e.target.value)} placeholder="Име на салон/бренд" />
        <CityCombobox value={city} onChange={setCity} placeholder="Град" />
        <TextField value={address} onChange={e=>setAddress(e.target.value)} placeholder="Адреса (точна локација)" />
        <TextField value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Телефон" />
        <textarea value={bio} onChange={e=>setBio(e.target.value)} placeholder="Кратко за тебе (опционално)" rows={3}
          className="bg-white border border-[#EDE3E0] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#B5566B] resize-none" />
        {error && <p className="text-[#B5566B] text-xs">{error}</p>}
        <button disabled={loading} onClick={save} className="mt-2 bg-[#B5566B] text-white rounded-xl py-3.5 text-sm font-medium flex items-center justify-center gap-2">
          {loading && <Loader2 size={15} className="animate-spin" />} Готово
        </button>
      </div>
    </div>
  );
}

function ProviderProfile({ provider, onSaved, onLogout }) {
  const [name, setName] = useState(provider.name);
  const [salon, setSalon] = useState(provider.salon);
  const [city, setCity] = useState(provider.city);
  const [phone, setPhone] = useState(provider.phone || "");
  const [address, setAddress] = useState(provider.address || "");
  const [bio, setBio] = useState(provider.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(provider.avatar_url || null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim() || !salon.trim() || !city.trim()) return;
    setSaving(true);
    const payload = { name: name.trim(), salon: salon.trim(), city: city.trim(), phone: phone.trim() || null, address: address.trim() || null, bio: bio.trim() || null, avatar_url: avatarUrl };
    const { error } = await supabase.from("providers").update(payload).eq("id", provider.id);
    setSaving(false);
    if (!error) onSaved({ ...provider, ...payload });
    else console.error(error);
  };
  return (
    <div className="flex flex-col gap-4">
      <AvatarPicker url={avatarUrl} onChange={setAvatarUrl} />
      <TextField value={name} onChange={e=>setName(e.target.value)} placeholder="Твоето име" />
      <TextField value={salon} onChange={e=>setSalon(e.target.value)} placeholder="Име на салон/бренд" />
      <CityCombobox value={city} onChange={setCity} />
      <TextField value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Телефон (го гледаат клиентите)" />
      <TextField value={address} onChange={e=>setAddress(e.target.value)} placeholder="Адреса (опционално)" />
      <textarea value={bio} onChange={e=>setBio(e.target.value)} placeholder="Кратко за тебе (опционално)" rows={3}
        className="bg-white border border-[#EDE3E0] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#B5566B] resize-none" />
      <TextField value={provider.email || ""} disabled placeholder="Е-пошта" className="opacity-60 cursor-not-allowed" />
      <button disabled={saving} onClick={save} className="bg-[#B5566B] text-white rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2">
        {saving && <Loader2 size={15} className="animate-spin"/>} Зачувај промени
      </button>
      <ChangePasswordSection />
      <button onClick={onLogout} className="mt-2 py-3 rounded-xl border border-[#EDE3E0] text-[#8B7A8E] text-sm font-medium">Одјави се</button>
    </div>
  );
}

// ---------------- Services manager ----------------
function ServiceManager({ provider, onUpdated }) {
  const [services, setServices] = useState(provider.services || []);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const persist = async (next) => {
    setSaving(true);
    setServices(next);
    const { error } = await supabase.from("providers").update({ services: next }).eq("id", provider.id);
    setSaving(false);
    if (error) console.error(error);
    else onUpdated(next);
  };

  const startAdd = () => setEditing({ category: CATEGORIES[0].id, name: "", price: "" });
  const startEdit = (s) => setEditing({ ...s });

  const save = () => {
    if (!editing.name.trim() || editing.price === "" || isNaN(Number(editing.price))) return;
    const entry = { id: editing.id || crypto.randomUUID(), category: editing.category, name: editing.name.trim(), price: Number(editing.price) };
    const next = editing.id ? services.map(s => s.id === editing.id ? entry : s) : [...services, entry];
    persist(next);
    setEditing(null);
  };

  const remove = (id) => persist(services.filter(s => s.id !== id));

  if (editing) {
    return (
      <div className="flex flex-col gap-3">
        <select value={editing.category} onChange={e=>setEditing({...editing, category: e.target.value})}
          className="bg-white border border-[#EDE3E0] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#B5566B]">
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
        <TextField value={editing.name} onChange={e=>setEditing({...editing, name: e.target.value})} placeholder='Име на услугата (пр. "Француски маникир")' />
        <TextField value={editing.price} onChange={e=>setEditing({...editing, price: e.target.value})} placeholder="Цена во денари" inputMode="numeric" />
        <div className="flex gap-2 mt-1">
          <button onClick={()=>setEditing(null)} className="flex-1 py-2.5 rounded-xl border border-[#EDE3E0] text-[#8B7A8E] text-xs font-medium">Откажи</button>
          <button disabled={saving} onClick={save} className="flex-1 py-2.5 rounded-xl bg-[#B5566B] text-white text-xs font-medium">Зачувај</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {services.length === 0 && <p className="text-[#B3A5B5] text-sm text-center pt-4">Сеуште немаш додадено услуги. Додади ги за клиентите да можат да те најдат.</p>}
      {services.map(s => (
        <div key={s.id} className="bg-white border border-[#EDE3E0] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[#2B1B2E] text-sm font-medium">{catInfo(s.category).icon} {s.name}</div>
            <div className="text-[#8B7A8E] text-xs mt-0.5">{catInfo(s.category).name} · {fmt(s.price)}</div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={()=>startEdit(s)} className="p-2 text-[#8B7A8E]"><Pencil size={15}/></button>
            <button onClick={()=>remove(s.id)} className="p-2 text-[#B5566B]"><Trash2 size={15}/></button>
          </div>
        </div>
      ))}
      <button onClick={startAdd} className="flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-[#D8C5CB] text-[#B5566B] text-sm font-medium mt-1">
        <Plus size={16}/> Додади услуга
      </button>
    </div>
  );
}

// ---------------- Availability manager ----------------
function AvailabilityManager({ provider }) {
  const [date, setDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [customTime, setCustomTime] = useState("");

  const load = async () => {
    const { data, error } = await supabase.from("availability").select("*").eq("provider_id", provider.id).gte("date", todayStr()).order("date").order("time");
    if (error) console.error(error);
    setSlots(data || []);
    setInitialLoading(false);
  };
  useEffect(() => { load(); }, [provider.id]);

  const addSlot = async (time) => {
    if (!date || !time) return;
    if (slots.some(s => s.date === date && s.time === time)) return;
    if (!isFutureSlot(date, time)) { alert("Не можеш да додадеш термин што веќе поминал."); return; }
    const { error } = await supabase.from("availability").insert({ provider_id: provider.id, date, time, status: "free" });
    if (error) console.error(error); else load();
  };

  const removeSlot = async (id) => {
    const { error } = await supabase.from("availability").delete().eq("id", id);
    if (error) console.error(error); else load();
  };

  const daySlots = slots.filter(s => s.date === date).sort((a,b)=>a.time.localeCompare(b.time));

  if (initialLoading) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      <MonthCalendar selectedDate={date} onSelect={setDate} />
      {date ? (
        <div>
          <div className="text-[#6B5A6E] text-xs font-medium mb-2 uppercase tracking-wide">{formatDate(date)} — додади час</div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {SUGGESTED_TIMES.filter(t => isFutureSlot(date, t)).map(t => {
              const exists = daySlots.some(s => s.time === t);
              return (
                <button key={t} disabled={exists} onClick={()=>addSlot(t)}
                  className={`py-2 rounded-lg text-xs font-medium border ${exists ? "bg-[#DCE6DE] border-[#4A6B54] text-[#3A5544]" : "bg-white border-[#EDE3E0] text-[#6B5A6E]"}`}>
                  {t}
                </button>
              );
            })}
          </div>
          {SUGGESTED_TIMES.filter(t => isFutureSlot(date, t)).length === 0 && (
            <p className="text-[#B3A5B5] text-xs mb-3">Нема повеќе слободни предложени часови за денес — додади свој час подолу.</p>
          )}
          <div className="flex gap-2 mb-4">
            <TextField value={customTime} onChange={e=>setCustomTime(e.target.value)} placeholder="Друг час (пр. 19:30)" className="flex-1" />
            <button onClick={()=>{ if(customTime.trim()){ addSlot(customTime.trim()); setCustomTime(""); } }}
              className="px-4 rounded-xl bg-[#2B1B2E] text-white text-xs font-medium">Додади</button>
          </div>
          {daySlots.length > 0 && (
            <div className="flex flex-col gap-2">
              {daySlots.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-white border border-[#EDE3E0] rounded-xl px-3 py-2.5">
                  <span className="text-xs text-[#2B1B2E] font-medium">{s.time} {s.status === "booked" && <span className="text-[#B5566B] font-normal ml-1">· зафатено</span>}</span>
                  {s.status === "free" ? (
                    <button onClick={()=>removeSlot(s.id)}><Trash2 size={14} className="text-[#B5566B]"/></button>
                  ) : <Check size={14} className="text-[#4A6B54]" />}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-[#B3A5B5] text-xs text-center">Избери датум погоре за да додадеш термини.</p>
      )}
    </div>
  );
}

// ---------------- Portfolio (provider manages, client views) ----------------
function PortfolioManager({ provider }) {
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const load = () => {
    setLoading(true);
    supabase.from("portfolio_photos").select("*").eq("provider_id", provider.id).eq("category", category).order("created_at")
      .then(({ data, error }) => { if (error) console.error(error); setPhotos(data || []); setLoading(false); });
  };
  useEffect(load, [provider.id, category]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photos.length >= 10) { alert("Максимум 10 слики по категорија."); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `portfolio/${provider.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file);
    if (error) { console.error(error); setUploading(false); alert("Не успеа да се качи сликата, обиди се повторно."); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: insErr } = await supabase.from("portfolio_photos").insert({ provider_id: provider.id, category, image_url: data.publicUrl });
    setUploading(false);
    if (insErr) console.error(insErr); else load();
  };

  const remove = async (id) => {
    const { error } = await supabase.from("portfolio_photos").delete().eq("id", id);
    if (error) console.error(error); else load();
  };

  return (
    <div>
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 mb-4">
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={()=>setCategory(c.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${category===c.id ? "bg-[#B5566B] text-white border-[#B5566B]" : "bg-white text-[#6B5A6E] border-[#EDE3E0]"}`}>{c.icon} {c.name}</button>
        ))}
      </div>
      {loading ? <Spinner /> : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {photos.map(p => (
              <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-[#F2EAE7]">
                <img src={p.image_url} className="w-full h-full object-cover" alt="" />
                <button onClick={()=>remove(p.id)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center">
                  <Trash2 size={12} className="text-white" />
                </button>
              </div>
            ))}
            {photos.length < 10 && (
              <button onClick={()=>inputRef.current?.click()} disabled={uploading}
                className="aspect-square rounded-xl border border-dashed border-[#D8C5CB] flex items-center justify-center text-[#B5566B]">
                {uploading ? <Loader2 size={18} className="animate-spin"/> : <Plus size={20}/>}
              </button>
            )}
          </div>
          <p className="text-[#B3A5B5] text-xs text-center">{photos.length}/10 слики во оваа категорија</p>
        </>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

function ProviderPortfolio({ providerId, category }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let q = supabase.from("portfolio_photos").select("*").eq("provider_id", providerId).order("created_at", { ascending: false });
    if (category) q = q.eq("category", category);
    q.then(({ data, error }) => { if (error) console.error(error); setPhotos(data || []); setLoading(false); });
  }, [providerId, category]);
  if (loading || photos.length === 0) return null;
  return (
    <div className="mt-6">
      <div className="text-[#6B5A6E] text-xs font-medium mb-2 uppercase tracking-wide">Претходни работи</div>
      <div className="grid grid-cols-3 gap-2">
        {photos.slice(0, 9).map(p => (
          <div key={p.id} className="aspect-square rounded-xl overflow-hidden bg-[#F2EAE7]">
            <img src={p.image_url} className="w-full h-full object-cover" alt="" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Provider home ----------------
function ProviderHomeScreen({ provider, pendingCount, upcomingCount, goTab }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-[#EDE3E0] rounded-2xl p-5">
        <div className="text-[#8B7A8E] text-xs">Здраво,</div>
        <div className="font-serif text-[#2B1B2E] text-xl mt-0.5" style={{fontWeight:600}}>{provider.name.split(" ")[0]} 👋</div>
        <p className="text-[#8B7A8E] text-sm mt-2">{provider.salon} · {provider.city}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white border border-[#EDE3E0] rounded-xl p-3 text-center">
          <div className="font-serif text-[#2B1B2E] text-lg" style={{fontWeight:600}}>{pendingCount}</div>
          <div className="text-[#8B7A8E] text-[10px] mt-0.5">Нови барања</div>
        </div>
        <div className="bg-white border border-[#EDE3E0] rounded-xl p-3 text-center">
          <div className="font-serif text-[#2B1B2E] text-lg" style={{fontWeight:600}}>{upcomingCount}</div>
          <div className="text-[#8B7A8E] text-[10px] mt-0.5">Закажани</div>
        </div>
        <div className="bg-white border border-[#EDE3E0] rounded-xl p-3 text-center">
          <div className="font-serif text-[#2B1B2E] text-lg flex items-center justify-center gap-1" style={{fontWeight:600}}><Star size={13} className="fill-[#B5566B] text-[#B5566B]"/>{provider.rating}</div>
          <div className="text-[#8B7A8E] text-[10px] mt-0.5">Оценка</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={()=>goTab("notifications")} className="bg-white border border-[#EDE3E0] rounded-2xl p-4 text-left hover:border-[#B5566B] transition-colors">
          <Bell size={18} className="text-[#B5566B] mb-2" />
          <div className="text-[#2B1B2E] text-sm font-medium">Известувања</div>
        </button>
        <button onClick={()=>goTab("calendar")} className="bg-white border border-[#EDE3E0] rounded-2xl p-4 text-left hover:border-[#B5566B] transition-colors">
          <Calendar size={18} className="text-[#4A6B54] mb-2" />
          <div className="text-[#2B1B2E] text-sm font-medium">Календар</div>
        </button>
        <button onClick={()=>goTab("services")} className="bg-white border border-[#EDE3E0] rounded-2xl p-4 text-left hover:border-[#B5566B] transition-colors">
          <Sparkles size={18} className="text-[#8A4A5A] mb-2" />
          <div className="text-[#2B1B2E] text-sm font-medium">Услуги</div>
        </button>
        <button onClick={()=>goTab("upcoming")} className="bg-white border border-[#EDE3E0] rounded-2xl p-4 text-left hover:border-[#B5566B] transition-colors">
          <Check size={18} className="text-[#4A6B54] mb-2" />
          <div className="text-[#2B1B2E] text-sm font-medium">Закажани</div>
        </button>
      </div>
    </div>
  );
}

function CancelReasonModal({ booking, onConfirm, onClose, saving }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-6 pb-6 sm:pb-0">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
        <h3 className="font-serif text-[#2B1B2E] text-lg" style={{fontWeight:600}}>Откажи термин</h3>
        <p className="text-[#8B7A8E] text-sm mt-1 mb-4">{booking.client_name} · {booking.service_name} · {booking.day}, {booking.time}</p>
        <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Наведи причина за откажување" rows={3}
          className="w-full bg-[#FDF9F7] border border-[#EDE3E0] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#B5566B] resize-none" />
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-[#EDE3E0] text-[#8B7A8E] text-sm font-medium">Назад</button>
          <button disabled={!reason.trim() || saving} onClick={()=>onConfirm(reason.trim())} className="flex-1 py-3 rounded-xl bg-[#B5566B] disabled:opacity-40 text-white text-sm font-medium flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin"/>} Откажи термин
          </button>
        </div>
      </div>
    </div>
  );
}

function ProviderDashboard({ provider: initialProvider, onLogout }) {
  const [provider, setProvider] = useState(initialProvider);
  const [tab, setTabRaw] = useState(() => localStorage.getItem("termin-provider-tab") || "home");
  const setTab = (t) => { localStorage.setItem("termin-provider-tab", t); setTabRaw(t); };
  const [view, setView] = useState("main");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(initialProvider.available);

  const loadBookings = () => {
    setLoading(true);
    supabase.from("bookings").select("*").eq("provider_id", provider.id).order("created_at", { ascending: false })
      .then(({ data, error }) => { if (error) console.error(error); setBookings(data || []); setLoading(false); });
  };
  useEffect(() => {
    loadBookings();
    const channel = supabase
      .channel(`provider-bookings-${provider.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `provider_id=eq.${provider.id}` }, () => loadBookings())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider.id]);

  const respond = async (booking, status) => {
    setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status } : b));
    const { error } = await supabase.from("bookings").update({ status }).eq("id", booking.id);
    if (error) { console.error(error); loadBookings(); return; }
    if (status === "declined" && booking.availability_id) {
      await supabase.from("availability").update({ status: "free" }).eq("id", booking.availability_id);
    }
  };

  const dismissCancellation = async (booking) => {
    setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, provider_notified: true } : b));
    const { error } = await supabase.from("bookings").update({ provider_notified: true }).eq("id", booking.id);
    if (error) { console.error(error); loadBookings(); }
  };

  const [cancelling, setCancelling] = useState(null);
  const [cancelSaving, setCancelSaving] = useState(false);
  const confirmProviderCancel = async (reason) => {
    setCancelSaving(true);
    const booking = cancelling;
    setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: "cancelled", cancel_reason: reason, cancelled_by: "provider" } : b));
    const { error } = await supabase.from("bookings").update({ status: "cancelled", cancel_reason: reason, cancelled_by: "provider" }).eq("id", booking.id);
    if (!error && booking.availability_id) await supabase.from("availability").update({ status: "free" }).eq("id", booking.availability_id);
    if (error) { console.error(error); loadBookings(); }
    setCancelSaving(false);
    setCancelling(null);
  };

  const toggleAvailable = async () => {
    const next = !available;
    setAvailable(next);
    await supabase.from("providers").update({ available: next }).eq("id", provider.id);
  };

  const pending = bookings.filter(b => b.status === "pending");
  const upcoming = bookings.filter(b => b.status === "accepted");
  const cancelledUnseen = bookings.filter(b => b.status === "cancelled" && b.provider_notified === false);
  const notifCount = pending.length + cancelledUnseen.length;

  if (view === "profile") {
    return (
      <div className="min-h-full bg-[#FDF9F7] flex flex-col px-6 pt-10 pb-8">
        <button onClick={()=>setView("main")} className="text-[#8B7A8E] flex items-center gap-1 text-sm mb-6"><ChevronLeft size={16}/>Назад</button>
        <h1 className="font-serif text-[#2B1B2E] text-2xl mb-6" style={{fontWeight:600}}>Профил</h1>
        <ProviderProfile provider={provider} onSaved={setProvider} onLogout={onLogout} />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#FDF9F7] flex flex-col">
      <div className="px-6 pt-10 pb-4 flex items-center justify-between">
        <button onClick={()=>setTab("home")} className="text-[#8B7A8E] p-1"><Home size={19}/></button>
        <Avatar url={provider.avatar_url} name={provider.name} size={30} />
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell size={18} className="text-[#8B7A8E]" />
            {notifCount > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#B5566B]" />}
          </div>
          <button onClick={()=>setView("profile")} className="text-[#8B7A8E] p-1"><User size={19}/></button>
        </div>
      </div>

      {tab !== "home" && (
        <div className="px-6">
          <div className="flex items-center justify-between bg-white border border-[#EDE3E0] rounded-2xl px-4 py-3.5 mb-4">
            <div className="flex items-center gap-2.5">
              <div className={`w-2 h-2 rounded-full ${available ? "bg-[#4A6B54]" : "bg-[#B3A5B5]"}`} />
              <span className="text-[#2B1B2E] text-sm font-medium">{available ? "Достапна за термини" : "Недостапна"}</span>
            </div>
            <button onClick={toggleAvailable} className={`w-11 h-6 rounded-full transition-colors relative ${available ? "bg-[#B5566B]" : "bg-[#DDD2D5]"}`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${available ? "left-5" : "left-0.5"}`} />
            </button>
          </div>
        </div>
      )}

      <div className="px-6 flex gap-1.5 bg-[#F2EAE7] rounded-xl p-1 overflow-x-auto no-scrollbar">
        {[
          {id:"home", label:"Дома"},
          {id:"notifications", label:`Известувања${notifCount ? ` (${notifCount})` : ""}`},
          {id:"upcoming", label:"Закажани"},
          {id:"calendar", label:"Календар"},
          {id:"services", label:"Услуги"},
          {id:"portfolio", label:"Слики"},
        ].map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${tab===t.id ? "bg-white text-[#2B1B2E] shadow-sm" : "text-[#8B7A8E]"}`}>{t.label}</button>
        ))}
      </div>

      <div className="flex-1 px-6 py-5">
        {tab === "home" && <ProviderHomeScreen provider={provider} pendingCount={pending.length} upcomingCount={upcoming.length} goTab={setTab} />}
        {tab === "services" && <ServiceManager provider={provider} onUpdated={(next)=>setProvider(p=>({...p, services: next}))} />}
        {tab === "portfolio" && <PortfolioManager provider={provider} />}
        {tab === "calendar" && <AvailabilityManager provider={provider} />}

        {tab === "notifications" && (
          loading ? <Spinner /> : (
            <div className="flex flex-col gap-3">
              {notifCount === 0 && <p className="text-[#B3A5B5] text-sm text-center pt-8">Нема нови известувања.</p>}

              {cancelledUnseen.map(b => (
                <div key={b.id} className="bg-[#F2DCDC] border border-[#E9C0C0] rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[#8A4A4A] text-sm font-medium">{b.client_name} го откажа терминот</div>
                      <div className="text-[#8A4A4A]/80 text-xs mt-0.5">{catInfo(b.category).icon} {b.service_name} · {b.day}, {b.time}</div>
                    </div>
                    <button onClick={()=>dismissCancellation(b)} className="text-[#8A4A4A] text-xs font-medium shrink-0">Во ред</button>
                  </div>
                </div>
              ))}

              {pending.map(b => (
                <div key={b.id} className="bg-white border border-[#EDE3E0] rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={b.client_name} size={36} />
                      <div>
                        <div className="text-[#2B1B2E] text-sm font-medium">{b.client_name}</div>
                        <div className="text-[#8B7A8E] text-xs">{catInfo(b.category).icon} {b.service_name} · {b.client_phone}</div>
                      </div>
                    </div>
                    <span className="text-[#2B1B2E] text-sm font-medium">{fmt(b.price)}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2.5 text-xs text-[#8B7A8E]">
                    <span className="flex items-center gap-1"><Calendar size={12}/>{b.day}</span>
                    <span className="flex items-center gap-1"><Clock size={12}/>{b.time}</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={()=>respond(b,"declined")} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[#EDE3E0] text-[#8B7A8E] text-xs font-medium">
                      <X size={13}/> Одбиј
                    </button>
                    <button onClick={()=>respond(b,"accepted")} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#4A6B54] text-white text-xs font-medium">
                      <Check size={13}/> Прифати
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === "upcoming" && (
          loading ? <Spinner /> : (
            <div className="flex flex-col gap-3">
              {upcoming.length === 0 && <p className="text-[#B3A5B5] text-sm text-center pt-8">Нема закажани термини.</p>}
              {upcoming.map(b => (
                <div key={b.id} className="bg-white border border-[#EDE3E0] rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={b.client_name} size={36} />
                      <div>
                        <div className="text-[#2B1B2E] text-sm font-medium">{b.client_name}</div>
                        <div className="text-[#8B7A8E] text-xs">{catInfo(b.category).icon} {b.service_name} · {b.client_phone}</div>
                      </div>
                    </div>
                    <span className="text-[#2B1B2E] text-sm font-medium">{fmt(b.price)}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2.5 text-xs text-[#8B7A8E]">
                    <span className="flex items-center gap-1"><Calendar size={12}/>{b.day}</span>
                    <span className="flex items-center gap-1"><Clock size={12}/>{b.time}</span>
                  </div>
                  <button onClick={()=>setCancelling(b)} className="mt-3 w-full py-2 rounded-xl border border-[#EDE3E0] text-[#B5566B] text-xs font-medium">Откажи термин</button>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {cancelling && (
        <CancelReasonModal booking={cancelling} saving={cancelSaving} onConfirm={confirmProviderCancel} onClose={()=>setCancelling(null)} />
      )}
    </div>
  );
}

function ProviderFlow({ onBack }) {
  const [session, setSession] = useState(undefined);
  const [provider, setProvider] = useState(null);
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return; // сесијата сеуште не е разрешена
    if (!session) { setProvider(null); setCheckingProfile(false); return; }
    setCheckingProfile(true);
    supabase.from("providers").select("*").eq("auth_user_id", session.user.id).maybeSingle()
      .then(({ data }) => { setProvider(data); setCheckingProfile(false); });
  }, [session]);

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("termin-provider-tab");
    onBack();
  };

  if (session === undefined || checkingProfile) return <div className="min-h-full bg-[#FDF9F7] flex flex-col"><Spinner /></div>;
  if (!session) return <ProviderAuth onBack={onBack} />;
  if (!provider) return <CompleteProviderProfile session={session} onDone={setProvider} onBack={onBack} />;
  return <ProviderDashboard provider={provider} onLogout={logout} />;
}

function ClientFlow({ onBack }) {
  const [session, setSession] = useState(undefined);
  const [client, setClient] = useState(null);
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return; // сесијата сеуште не е разрешена
    if (!session) { setClient(null); setCheckingProfile(false); return; }
    setCheckingProfile(true);
    supabase.from("clients").select("*").eq("auth_user_id", session.user.id).maybeSingle()
      .then(({ data }) => { setClient(data); setCheckingProfile(false); });
  }, [session]);

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("termin-client-view");
    onBack();
  };

  if (session === undefined || checkingProfile) return <div className="min-h-full bg-[#FDF9F7] flex flex-col"><Spinner /></div>;
  if (!session) return <ClientAuth onBack={onBack} />;
  if (!client) return <CompleteClientProfile session={session} onDone={setClient} onBack={onBack} />;
  return <ClientHome client={client} onHome={onBack} onLogout={logout} />;
}

// ---------------- Root ----------------
export default function App() {
  const [role, setRole] = useState(() => localStorage.getItem("termin-role") || null);
  const pick = (r) => { localStorage.setItem("termin-role", r); setRole(r); };
  const clearRole = () => { localStorage.removeItem("termin-role"); setRole(null); };
  return (
    <div className="w-full min-h-screen bg-[#FDF9F7] flex justify-center">
      <div className="w-full max-w-sm min-h-screen bg-[#FDF9F7] relative">
        {!role && <RoleSelect onPick={pick} />}
        {role === "client" && <ClientFlow onBack={clearRole} />}
        {role === "provider" && <ProviderFlow onBack={clearRole} />}
      </div>
    </div>
  );
}