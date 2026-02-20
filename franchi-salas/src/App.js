import { useState, useEffect, useCallback } from "react";
import { db } from "./firebase";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc
} from "firebase/firestore";

const COLORS = { blue: "#10069f", pink: "#e0004d", white: "#fff", gray: "#f4f5fa", border: "#e2e4f0", text: "#1a1a2e" };
const SALAS = ["Sala 713", "Sala do Felipe"];
const SALA_COLORS = { "Sala 713": "#10069f", "Sala do Felipe": "#e0004d" };
const SETORES = ["Administrativo","Comercial","Financeiro","RH","TI","Operações","Marketing","Jurídico","Diretoria","Outro"];
const SLOT_HEIGHT = 48;
const HOUR_START = 7, HOUR_END = 22;
const TOTAL_SLOTS = (HOUR_END - HOUR_START) * 2;

const todayStr = () => new Date().toISOString().split('T')[0];
const weekDates = ref => {
  const d = new Date(ref + 'T12:00:00'), day = d.getDay();
  const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return x.toISOString().split('T')[0]; });
};
const fmtDate = s => { if (!s) return ''; const p = s.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; };
const fmtDay = s => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][new Date(s + 'T12:00:00').getDay()];
const toMins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const timeToSlot = t => { const [h, m] = t.split(':').map(Number); return (h - HOUR_START) * 2 + (m >= 30 ? 1 : 0); };
const slotToTime = i => { const h = Math.floor(i / 2) + HOUR_START, m = i % 2 === 0 ? '00' : '30'; return `${String(h).padStart(2, '0')}:${m}`; };
const overlap = (a, b) => toMins(a.inicio) < toMins(b.fim) && toMins(a.fim) > toMins(b.inicio);
const emptyForm = { nome: '', setor: '', externo: 'nao', data: todayStr(), inicio: '08:00', fim: '09:00', assunto: '', sala: SALAS[0] };

// ── Campos fora do App para evitar perda de foco ──
const FieldText = ({ label, name, value, onChange, error, required }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>
      {label}{required && <span style={{ color: COLORS.pink }}>*</span>}
    </label>
    <input type="text" value={value} onChange={e => onChange(name, e.target.value)}
      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${error ? COLORS.pink : COLORS.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
    {error && <div style={{ color: COLORS.pink, fontSize: 11, marginTop: 3 }}>{error}</div>}
  </div>
);
const FieldSelect = ({ label, name, value, onChange, options, error, required }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>
      {label}{required && <span style={{ color: COLORS.pink }}>*</span>}
    </label>
    <select value={value} onChange={e => onChange(name, e.target.value)}
      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${error ? COLORS.pink : COLORS.border}`, fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' }}>
      <option value="">Selecione...</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
    {error && <div style={{ color: COLORS.pink, fontSize: 11, marginTop: 3 }}>{error}</div>}
  </div>
);
const FieldDate = ({ label, name, value, onChange, error, required }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>
      {label}{required && <span style={{ color: COLORS.pink }}>*</span>}
    </label>
    <input type="date" value={value} onChange={e => onChange(name, e.target.value)}
      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${error ? COLORS.pink : COLORS.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
    {error && <div style={{ color: COLORS.pink, fontSize: 11, marginTop: 3 }}>{error}</div>}
  </div>
);
const FieldTime = ({ label, name, value, onChange, error, required }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>
      {label}{required && <span style={{ color: COLORS.pink }}>*</span>}
    </label>
    <input type="time" value={value} onChange={e => onChange(name, e.target.value)}
      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${error ? COLORS.pink : COLORS.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
    {error && <div style={{ color: COLORS.pink, fontSize: 11, marginTop: 3 }}>{error}</div>}
  </div>
);
const FieldRadio = ({ label, name, value, onChange, options }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6 }}>{label}</label>
    <div style={{ display: 'flex', gap: 20 }}>
      {options.map(o => (
        <label key={o.v} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
          <input type="radio" name={name} value={o.v} checked={value === o.v} onChange={e => onChange(name, e.target.value)} style={{ accentColor: COLORS.blue }} />
          {o.l}
        </label>
      ))}
    </div>
  </div>
);
const FieldTextarea = ({ label, name, value, onChange, error, required }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>
      {label}{required && <span style={{ color: COLORS.pink }}>*</span>}
    </label>
    <textarea value={value} onChange={e => onChange(name, e.target.value)} rows={3}
      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${error ? COLORS.pink : COLORS.border}`, fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
    {error && <div style={{ color: COLORS.pink, fontSize: 11, marginTop: 3 }}>{error}</div>}
  </div>
);

// ── App principal ──
export default function App() {
  const [view, setView] = useState('semanal');
  const [refDate, setRefDate] = useState(todayStr());
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Escuta o Firestore em tempo real
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "agendamentos"), snapshot => {
      setAgendamentos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleField = useCallback((name, value) => {
    setForm(f => ({ ...f, [name]: value }));
  }, []);

  const validate = () => {
    const e = {};
    if (!form.nome.trim()) e.nome = 'Obrigatório';
    if (!form.setor) e.setor = 'Obrigatório';
    if (!form.data) e.data = 'Obrigatório';
    if (!form.assunto.trim()) e.assunto = 'Obrigatório';
    if (toMins(form.fim) <= toMins(form.inicio)) e.fim = 'Fim deve ser após o início';
    const conflict = agendamentos.find(a => a.sala === form.sala && a.data === form.data && a.id !== editId && overlap(a, form));
    if (conflict) e.sala = `Conflito: ${conflict.nome} (${conflict.inicio}–${conflict.fim})`;
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      const { id, ...data } = form;
      if (editId) {
        await updateDoc(doc(db, "agendamentos", editId), data);
      } else {
        await addDoc(collection(db, "agendamentos"), data);
      }
      setModal(false); setForm(emptyForm); setEditId(null); setErrors({});
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert("Erro ao salvar. Tente novamente.");
    }
    setSaving(false);
  };

  const openNew = () => { setForm(emptyForm); setEditId(null); setErrors({}); setModal(true); };
  const openEdit = a => { setForm({ ...a }); setEditId(a.id); setErrors({}); setModal(true); };
  const doDelete = async id => {
    await deleteDoc(doc(db, "agendamentos", id));
    setDeleteConfirm(null);
  };

  const navigate = dir => {
    const d = new Date(refDate + 'T12:00:00');
    view === 'diario' ? d.setDate(d.getDate() + dir) : d.setDate(d.getDate() + dir * 7);
    setRefDate(d.toISOString().split('T')[0]);
  };

  const renderCalendarGrid = (dates) => {
    const isDaily = dates.length === 1;
    const getAgs = (date, sala) => agendamentos.filter(a => a.data === date && a.sala === sala);
    const agStyle = a => {
      const s = timeToSlot(a.inicio), e = timeToSlot(a.fim);
      return { top: s * SLOT_HEIGHT, height: Math.max(e - s, 1) * SLOT_HEIGHT - 3 };
    };
    const now = new Date();
    const nowSlot = (now.getHours() - HOUR_START) * 2 + (now.getMinutes() >= 30 ? 1 : 0);
    const showNow = nowSlot >= 0 && nowSlot < TOTAL_SLOTS;

    return (
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '72vh' }}>
        <div style={{ display: 'flex', minWidth: isDaily ? 500 : 900 }}>
          <div style={{ width: 52, flexShrink: 0 }}>
            <div style={{ height: isDaily ? 48 : 72, borderBottom: `2px solid ${COLORS.border}`, background: COLORS.gray, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 6, fontSize: 10, color: '#aaa', fontWeight: 600 }}>HR</div>
            <div style={{ position: 'relative' }}>
              {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
                <div key={i} style={{ height: SLOT_HEIGHT, borderBottom: `1px solid ${i % 2 === 0 ? COLORS.border : '#f0f0f0'}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 8, paddingTop: 3, fontSize: 11, color: i % 2 === 0 ? '#999' : 'transparent', background: '#fafafa', boxSizing: 'border-box' }}>
                  {i % 2 === 0 ? slotToTime(i) : '·'}
                </div>
              ))}
            </div>
          </div>

          {SALAS.map(sala => (
            <div key={sala} style={{ flex: 1, minWidth: isDaily ? 200 : 0 }}>
              <div style={{ height: isDaily ? 48 : 72, borderBottom: `2px solid ${COLORS.border}`, borderLeft: `1px solid ${COLORS.border}`, background: COLORS.gray, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2, padding: '4px 0' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: SALA_COLORS[sala], display: 'inline-block' }} />
                <span style={{ fontSize: isDaily ? 13 : 11, fontWeight: 700, color: SALA_COLORS[sala], textAlign: 'center', lineHeight: 1.2, padding: '0 4px' }}>{sala}</span>
              </div>
              {isDaily ? (
                <div style={{ position: 'relative', height: TOTAL_SLOTS * SLOT_HEIGHT }}>
                  {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
                    <div key={i} style={{ position: 'absolute', top: i * SLOT_HEIGHT, left: 0, right: 0, height: SLOT_HEIGHT, borderBottom: `1px solid ${i % 2 === 0 ? COLORS.border : '#f8f8f8'}`, borderLeft: `1px solid ${COLORS.border}`, background: dates[0] === todayStr() ? '#fafafe' : '#fff' }} />
                  ))}
                  {showNow && dates[0] === todayStr() && <div style={{ position: 'absolute', top: nowSlot * SLOT_HEIGHT, left: 0, right: 0, height: 2, background: COLORS.pink, zIndex: 5 }} />}
                  {getAgs(dates[0], sala).map(a => {
                    const { top, height } = agStyle(a);
                    return (
                      <div key={a.id} onClick={() => openEdit(a)} style={{ position: 'absolute', top, left: 3, right: 3, height, background: SALA_COLORS[a.sala], borderRadius: 7, color: '#fff', padding: '4px 8px', cursor: 'pointer', zIndex: 3, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,.15)', boxSizing: 'border-box' }}>
                        <div style={{ fontWeight: 700, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.assunto}</div>
                        <div style={{ fontSize: 11, opacity: .85 }}>{a.inicio}–{a.fim}</div>
                        {height > 52 && <div style={{ fontSize: 10, opacity: .75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome} · {a.setor}</div>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', borderLeft: `1px solid ${COLORS.border}` }}>
                  {dates.map(date => (
                    <div key={date} style={{ flex: 1, minWidth: 0, position: 'relative', height: TOTAL_SLOTS * SLOT_HEIGHT + 72, borderRight: `1px solid ${COLORS.border}` }}>
                      <div style={{ position: 'sticky', top: 0, zIndex: 4, background: date === todayStr() ? '#eef' : '#fff', borderBottom: `1px solid ${COLORS.border}`, padding: '4px 2px', textAlign: 'center', height: 72, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: date === todayStr() ? COLORS.blue : '#888' }}>{fmtDay(date)}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: date === todayStr() ? COLORS.blue : '#333' }}>{fmtDate(date).slice(0, 5)}</div>
                      </div>
                      {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
                        <div key={i} style={{ position: 'absolute', top: 72 + i * SLOT_HEIGHT, left: 0, right: 0, height: SLOT_HEIGHT, borderBottom: `1px solid ${i % 2 === 0 ? COLORS.border : '#f8f8f8'}`, background: date === todayStr() ? '#fafafe' : '#fff' }} />
                      ))}
                      {showNow && date === todayStr() && <div style={{ position: 'absolute', top: 72 + nowSlot * SLOT_HEIGHT, left: 0, right: 0, height: 2, background: COLORS.pink, zIndex: 5 }} />}
                      {getAgs(date, sala).map(a => {
                        const { top, height } = agStyle(a);
                        return (
                          <div key={a.id} onClick={() => openEdit(a)} style={{ position: 'absolute', top: 72 + top, left: 2, right: 2, height, background: SALA_COLORS[a.sala], borderRadius: 6, color: '#fff', padding: '3px 5px', cursor: 'pointer', zIndex: 3, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.15)', boxSizing: 'border-box' }}>
                            <div style={{ fontWeight: 700, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.assunto}</div>
                            {height > 36 && <div style={{ fontSize: 9, opacity: .85 }}>{a.inicio}–{a.fim}</div>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderLista = () => {
    const sorted = [...agendamentos].sort((a, b) => a.data.localeCompare(b.data) || a.inicio.localeCompare(b.inicio));
    const future = sorted.filter(a => a.data >= todayStr());
    if (!future.length) return <div style={{ textAlign: 'center', color: '#aaa', padding: 40 }}>Nenhum agendamento futuro.</div>;
    let lastDate = '';
    return (
      <div>
        {future.map(a => {
          const showDate = a.data !== lastDate; lastDate = a.data;
          return (
            <div key={a.id}>
              {showDate && <div style={{ padding: '12px 0 4px', fontWeight: 700, color: COLORS.blue, fontSize: 13, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 6 }}>{fmtDay(a.data)}, {fmtDate(a.data)}</div>}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px', borderRadius: 10, marginBottom: 6, background: '#fff', border: `1px solid ${COLORS.border}`, boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
                <div style={{ width: 4, minHeight: 60, borderRadius: 4, background: SALA_COLORS[a.sala], flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.text }}>{a.assunto}</div>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{a.sala} · {a.inicio}–{a.fim}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>{a.nome} · {a.setor}{a.externo === 'sim' ? ' · 👥 Público Externo' : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => openEdit(a)} style={{ background: 'none', border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: COLORS.blue }}>✏️</button>
                  <button onClick={() => setDeleteConfirm(a.id)} style={{ background: 'none', border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: COLORS.pink }}>🗑️</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const dates = view === 'semanal' ? weekDates(refDate) : [refDate];

  return (
    <div style={{ minHeight: '100vh', background: COLORS.gray, fontFamily: 'Segoe UI,Arial,sans-serif' }}>
      {/* HEADER */}
      <div style={{ background: COLORS.blue, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 12px rgba(16,6,159,.3)', height: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <svg width="44" height="44" viewBox="253.7 155.91 283.46 283.46" xmlns="http://www.w3.org/2000/svg">
            <path fill="#df014e" d="M537.16,191.34a35.43,35.43,0,0,0-35.43-35.43H360v70.86H289.13a35.43,35.43,0,0,0,0,70.86H360V226.77H501.73A35.43,35.43,0,0,0,537.16,191.34Z"/>
            <path fill="#df014e" d="M466.3,297.7v-.06H360V368.5H466.3v-.06a35.39,35.39,0,0,0,0-70.74Z"/>
            <path fill="#df014e" d="M253.7,403.94a35.43,35.43,0,0,0,35.43,35.43H360V368.5H289.13A35.44,35.44,0,0,0,253.7,403.94Z"/>
          </svg>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 17, letterSpacing: 2 }}>FRANCHI</div>
            <div style={{ color: 'rgba(255,255,255,.65)', fontSize: 11, letterSpacing: 1 }}>SALAS DE REUNIÃO</div>
          </div>
        </div>
        <button onClick={openNew} style={{ background: COLORS.pink, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 8px rgba(224,0,77,.4)' }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Novo Agendamento
        </button>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          {SALAS.map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 20, padding: '5px 14px', border: `1px solid ${COLORS.border}`, fontSize: 13, fontWeight: 600, color: SALA_COLORS[s] }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: SALA_COLORS[s], display: 'inline-block' }} />
              {s}
            </div>
          ))}
          {loading && <div style={{ fontSize: 12, color: '#aaa', display: 'flex', alignItems: 'center', gap: 6 }}>⏳ Carregando agendamentos...</div>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden', border: `1.5px solid ${COLORS.border}`, background: '#fff' }}>
            {[['diario', '📅 Diário'], ['semanal', '🗓 Semanal'], ['lista', '📋 Lista']].map(([v, l]) => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '9px 18px', background: view === v ? COLORS.blue : '#fff', color: view === v ? '#fff' : '#555', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all .15s' }}>{l}</button>
            ))}
          </div>
          {view !== 'lista' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => navigate(-1)} style={{ background: '#fff', border: `1.5px solid ${COLORS.border}`, borderRadius: 8, width: 34, height: 34, cursor: 'pointer', fontSize: 18, fontWeight: 700, color: COLORS.blue, lineHeight: 1 }}>‹</button>
              <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, minWidth: 150, textAlign: 'center' }}>
                {view === 'diario' ? `${fmtDay(refDate)}, ${fmtDate(refDate)}` : `${fmtDate(weekDates(refDate)[0]).slice(0, 5)} – ${fmtDate(weekDates(refDate)[6]).slice(0, 5)}`}
              </span>
              <button onClick={() => navigate(1)} style={{ background: '#fff', border: `1.5px solid ${COLORS.border}`, borderRadius: 8, width: 34, height: 34, cursor: 'pointer', fontSize: 18, fontWeight: 700, color: COLORS.blue, lineHeight: 1 }}>›</button>
              <button onClick={() => setRefDate(todayStr())} style={{ background: '#fff', border: `1.5px solid ${COLORS.border}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: COLORS.blue }}>Hoje</button>
            </div>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${COLORS.border}`, padding: 12, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>⏳ Carregando...</div>
          ) : view === 'lista' ? renderLista() : renderCalendarGrid(dates)}
        </div>
      </div>

      {saved && (
        <div style={{ position: 'fixed', bottom: 30, right: 30, background: COLORS.blue, color: '#fff', padding: '12px 24px', borderRadius: 12, fontWeight: 600, fontSize: 14, boxShadow: '0 4px 16px rgba(16,6,159,.4)', zIndex: 999 }}>
          ✅ Agendamento salvo!
        </div>
      )}

      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 340, width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🗑️</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Excluir agendamento?</div>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 22 }}>Essa ação não pode ser desfeita.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '10px 22px', borderRadius: 10, border: `1.5px solid ${COLORS.border}`, background: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>Cancelar</button>
              <button onClick={() => doDelete(deleteConfirm)} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: COLORS.pink, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: COLORS.blue }}>{editId ? 'Editar' : 'Novo'} Agendamento</div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>Franchi · Salas de Reunião</div>
              </div>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#aaa' }}>×</button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6 }}>Sala<span style={{ color: COLORS.pink }}>*</span></label>
              <div style={{ display: 'flex', gap: 10 }}>
                {SALAS.map(s => (
                  <button key={s} onClick={() => handleField('sala', s)}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${form.sala === s ? SALA_COLORS[s] : COLORS.border}`, background: form.sala === s ? SALA_COLORS[s] : '#fff', color: form.sala === s ? '#fff' : '#555', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all .15s' }}>
                    {s}
                  </button>
                ))}
              </div>
              {errors.sala && <div style={{ color: COLORS.pink, fontSize: 11, marginTop: 4 }}>{errors.sala}</div>}
            </div>

            <FieldText label="Nome do Responsável" name="nome" value={form.nome} onChange={handleField} error={errors.nome} required />
            <FieldSelect label="Setor" name="setor" value={form.setor} onChange={handleField} options={SETORES} error={errors.setor} required />
            <FieldRadio label="Público Externo?" name="externo" value={form.externo} onChange={handleField} options={[{ v: 'nao', l: 'Não' }, { v: 'sim', l: 'Sim' }]} />
            <FieldDate label="Data da Reunião" name="data" value={form.data} onChange={handleField} error={errors.data} required />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <FieldTime label="Horário de Início" name="inicio" value={form.inicio} onChange={handleField} error={errors.inicio} required />
              <FieldTime label="Horário de Fim" name="fim" value={form.fim} onChange={handleField} error={errors.fim} required />
            </div>
            <FieldTextarea label="Assunto da Reunião" name="assunto" value={form.assunto} onChange={handleField} error={errors.assunto} required />

            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <button onClick={() => setModal(false)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: `1.5px solid ${COLORS.border}`, background: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14, color: '#555' }}>Cancelar</button>
              <button onClick={submit} disabled={saving} style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: saving ? '#aaa' : COLORS.blue, color: '#fff', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, boxShadow: `0 4px 14px rgba(16,6,159,.3)` }}>
                {saving ? 'Salvando...' : editId ? 'Salvar Alterações' : 'Confirmar Agendamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
