const today = new Date();
const storageKey = "lehrerkalender-prototype-v1";
const coursePalette = ["#5f8f7f","#6f8fb4","#c07a68","#9a7db5","#c39b52","#4f9aa8","#b26f8b","#7f9360","#d08a4f","#6586a8","#a47761","#718f96"];

const defaultCourses = [
  { id:"beispielkurs", name:"Testkurs", subject:"Beispielfach", room:"R 1", color:"#76a992", organization:"course", courseType:"Grundkurs", rosterId:"course-beispiel", written:true }
];

const demoStudents = [
  { id: 1, name: "Alex B.", previous: null, grades: [], absences: 0 },
  { id: 2, name: "Kim M.", previous: null, grades: [], absences: 0 }
];

let state = loadState();
let activeCategory = "oral";
let activeWeight = 2;
let activeEntryArea = "lesson";
let activeWrittenType = "Klausur";
let expandedStudent = null;

function defaultState() {
  const rosters = {};
  defaultCourses.forEach(course => { if (!rosters[course.rosterId]) rosters[course.rosterId] = structuredClone(demoStudents); });
  return normalizeAcademicData({ courseId: "beispielkurs", quarter: "Q1", courses: structuredClone(defaultCourses), rosters, tasksDone: [], finalOverrides: {}, excused: {}, weekOffset: 0, seriesByCourse: defaultSeries(), lessonPlans: {}, timetable: defaultTimetable(), scheduleChanges: {}, attendance: {}, archives: [], settings: defaultSettings(), scheduleSetupVersion: 1 });
}

function defaultSettings() {
  return {displayName:"Ich",initials:"I",schoolYear:"2026/27",quarterEndDate:"",lastBackupAt:"",lockHash:"",lockMinutes:5,lessonTimes:["08:00","08:50","09:55","10:45","11:50","12:40","13:35","14:25"]};
}

function defaultTimetable() {
  return Array(40).fill(null);
}

function expandLegacyTimetable(legacy) {
  const expanded=Array(40).fill(null); const rowMap=[0,2,4,5,6];
  legacy.forEach((item,index)=>{
    if(!item) return;
    const oldRow=Math.floor(index/5); const col=index%5; const row=rowMap[oldRow]; const duration=[0,1,4].includes(oldRow)?2:1; const newIndex=row*5+col;
    expanded[newIndex]={...item,duration};
    if(duration===2) expanded[newIndex+5]={continuesFrom:newIndex};
  });
  return expanded;
}

function migrateLegacyLessonPlans(plans) {
  const rowMap=[0,2,4,5,6]; const migrated={};
  Object.entries(plans||{}).forEach(([key,plan])=>{
    const parts=key.split("|"); const oldRow=Number(parts[2]);
    if(parts.length===3 && rowMap[oldRow]!==undefined) parts[2]=String(rowMap[oldRow]);
    migrated[parts.join("|")]=plan;
  });
  return migrated;
}

function defaultSeries() {
  return {};
}

function newGradeId() { return `grade-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }

function normalizeAcademicData(data) {
  data.archives ||= [];
  if(data.courseColorVersion!==1) {
    let colorIndex=0;
    (data.courses||[]).forEach(course=>{ course.color=course.organizationOnly?"#c19a52":coursePalette[colorIndex++%coursePalette.length]; });
    data.courseColorVersion=1;
  }
  Object.values(data.rosters || {}).forEach(roster => roster.forEach(student => {
    student.grades ||= [];
    student.absences = Number(student.absences || 0);
    student.grades.forEach((grade,index) => {
      grade.id ||= `grade-${student.id}-${index}-${Math.random().toString(36).slice(2,6)}`;
      grade.quarter ||= data.quarter || "Q1";
      grade.schoolYear ||= data.settings?.schoolYear || "2026/27";
    });
  }));
  Object.entries(data.attendance || {}).forEach(([key,entry]) => { entry.quarter ||= data.quarter || "Q1"; entry.schoolYear ||= data.settings?.schoolYear || "2026/27"; entry.studentId ||= Number(key.split("|").at(-1)) || null; });
  return data;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved) return defaultState();
    if (!saved.courses || !saved.rosters) {
      const oldStudents = saved.students || structuredClone(demoStudents);
      saved.courses = structuredClone(defaultCourses);
      saved.rosters = {};
      defaultCourses.forEach(course => { if (!saved.rosters[course.rosterId]) saved.rosters[course.rosterId] = structuredClone(oldStudents); });
      delete saved.students;
    }
    if (!saved.seriesByCourse) saved.seriesByCourse = defaultSeries();
    if (!saved.lessonPlans) saved.lessonPlans = {};
    if (!saved.scheduleChanges) saved.scheduleChanges = {};
    if (!saved.attendance) saved.attendance = {};
    if (!saved.archives) saved.archives = [];
    saved.settings={...defaultSettings(),...(saved.settings||{})};
    const legacySchedule=!saved.timetable || saved.timetable.length===25;
    if (!saved.timetable) saved.timetable = defaultTimetable();
    else if(saved.timetable.length===25) saved.timetable=expandLegacyTimetable(saved.timetable);
    if(legacySchedule) saved.lessonPlans=migrateLegacyLessonPlans(saved.lessonPlans);
    if(saved.scheduleSetupVersion!==1) {
      saved.courses=structuredClone(defaultCourses); saved.rosters={};
      defaultCourses.forEach(course=>{ if(!saved.rosters[course.rosterId]) saved.rosters[course.rosterId]=structuredClone(demoStudents); });
      saved.courseId="beispielkurs"; saved.timetable=defaultTimetable(); saved.seriesByCourse={}; saved.lessonPlans={}; saved.scheduleSetupVersion=1;
    }
    if (saved.weekOffset == null) saved.weekOffset = 0;
    return normalizeAcademicData(saved);
  }
  catch { return defaultState(); }
}

function saveState() { localStorage.setItem(storageKey, JSON.stringify(state)); }
function q(selector, root=document) { return root.querySelector(selector); }
function qa(selector, root=document) { return [...root.querySelectorAll(selector)]; }
function currentCourse() { return state.courses.find(course => course.id === state.courseId) || state.courses[0]; }
function currentStudents() { const course = currentCourse(); return state.rosters[course.rosterId] || (state.rosters[course.rosterId] = []); }
function safeCourseColor(course) { return /^#[0-9a-f]{6}$/i.test(course?.color||"")?course.color:coursePalette[0]; }
function nextCourseColor() { return coursePalette[state.courses.filter(course=>!course.organizationOnly).length%coursePalette.length]; }

function showToast(message) {
  const toast = q("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2300);
}

async function hashPin(pin) {
  const bytes=new TextEncoder().encode(`lehrerkalender-local-lock:${pin}`); const digest=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,"0")).join("");
}

function showPrivacyLock() {
  if(!state.settings.lockHash) return; q("#detailDialog")?.close(); q("#absenceDialog")?.close(); q("#privacyLock").classList.remove("hidden"); q("#unlockPin").value=""; q("#unlockStatus").textContent=""; setTimeout(()=>q("#unlockPin").focus(),0);
}

async function unlockApp() {
  const pin=q("#unlockPin").value; if(await hashPin(pin)!==state.settings.lockHash) { q("#unlockStatus").textContent="PIN nicht erkannt"; q("#unlockPin").select(); return; }
  q("#privacyLock").classList.add("hidden"); q("#unlockPin").value="";
}

function formatShortDate(value) { return new Intl.DateTimeFormat("de-DE",{weekday:"short",day:"2-digit",month:"2-digit"}).format(new Date(`${value}T12:00:00`)); }

function nextUnplannedLesson() {
  const start=new Date(today); start.setHours(12,0,0,0);
  for(let offset=0;offset<21;offset++) {
    const date=addDays(start,offset); const col=date.getDay()-1; if(col<0 || col>4 || isSchoolFree(date)) continue;
    for(let row=0;row<timetableTimes.length;row++) {
      const raw=state.timetable[row*5+col]; if(!raw?.courseId) continue; const course=state.courses.find(candidate=>candidate.id===raw.courseId); if(!course || course.organizationOnly) continue;
      const key=lessonKey(date,course.id,row); const plan=state.lessonPlans[key]; if(!plan || plan.status==="unplanned") return {date:dateKey(date),row,course};
    }
  }
  return null;
}

function buildNotifications() {
  const items=[]; const todayKey=dateKey(today); const inSevenDays=dateKey(addDays(today,7));
  const nextLesson=nextUnplannedLesson(); if(nextLesson) items.push({icon:"○",title:"Nächste Stunde noch ungeplant",detail:`${formatShortDate(nextLesson.date)} · ${timetableTimes[nextLesson.row].label}. Stunde · ${nextLesson.course.name} ${nextLesson.course.subject}`});
  Object.values(state.lessonPlans).filter(plan=>plan.homework?.trim() && plan.homeworkDue>=todayKey && plan.homeworkDue<=inSevenDays).slice(0,3).forEach(plan=>{ const course=state.courses.find(candidate=>candidate.id===plan.courseId); items.push({icon:"▤",title:"Hausaufgabe wird besprochen",detail:`${formatShortDate(plan.homeworkDue)} · ${course?`${course.name} ${course.subject}`:"Kurs"}`}); });
  scheduleChangeGroups().filter(group=>{ const date=group.key.split("|")[0]; return date>=todayKey && date<=inSevenDays; }).slice(0,3).forEach(group=>items.push({icon:"↻",title:"Stundenplanänderung",detail:scheduleChangeLabel(group.change,group.key)}));
  if(state.settings.quarterEndDate) { const days=Math.ceil((new Date(`${state.settings.quarterEndDate}T12:00:00`)-new Date(`${todayKey}T12:00:00`))/86400000); if(days>=0&&days<=14) items.push({icon:"◎",title:"Quartalsende vorbereiten",detail:`Noch ${days} Tag${days===1?"":"e"}: Noten und Fehlstunden abgleichen`}); }
  const lastBackup=state.settings.lastBackupAt?new Date(state.settings.lastBackupAt):null; const backupAge=lastBackup?Math.floor((today-lastBackup)/86400000):Infinity;
  if(backupAge>=7) items.push({icon:"⇩",title:"Lokale Sicherung empfohlen",detail:lastBackup?`Letzte Sicherung vor ${backupAge} Tagen`:"Für dieses Gerät wurde noch keine Sicherung erstellt"});
  return items;
}

function renderTopbar() {
  q("#profileButton").textContent=state.settings.initials||"I"; q("#profileButton").title=state.settings.displayName||"Einstellungen & Daten";
  q(".notification-dot").classList.toggle("hidden",buildNotifications().length===0);
}

function lessonsOnDate(date) {
  const col=date.getDay()-1; if(col<0 || col>4 || isSchoolFree(date)) return [];
  const result=[]; const dateString=dateKey(date);
  for(let row=0;row<timetableTimes.length;row++) {
    const raw=state.timetable[row*5+col]; if(raw?.continuesFrom!==undefined) continue;
    const change=state.scheduleChanges[scheduleChangeKey(dateString,row)];
    if(!raw?.courseId && !change?.courseId) continue;
    const courseId=change?.courseId || raw?.courseId; const course=state.courses.find(candidate=>candidate.id===courseId); if(!course) continue;
    result.push({date:dateString,row,course,room:change?.room || raw?.room || course.room || "",duration:raw?.duration || 1,canceled:change?.kind==="cancel"});
  }
  return result;
}

function renderToday() {
  q("#todayWeekday").textContent=new Intl.DateTimeFormat("de-DE",{weekday:"long"}).format(today);
  const todayLessons=lessonsOnDate(today);
  q("#todaySchedule").innerHTML=todayLessons.length ? todayLessons.map(item=>`<div class="mini-lesson"><span class="time">${timetableTimes[item.row].time}</span><span class="course-color" style="background:${safeCourseColor(item.course)}"></span><div><b>${escapeHtml(item.course.name)} · ${escapeHtml(item.course.subject)}</b><small>${item.canceled?"Fällt aus":`${escapeHtml(item.room||"ohne Raum")} · ${item.duration===2?"Doppelstunde":"Einzelstunde"}`}</small></div></div>`).join("") : `<div class="empty-sunday"><div class="leaf-icon">✓</div><h4>Heute ist unterrichtsfrei</h4><p>Ein guter Moment, die kommende Woche in Ruhe vorzubereiten.</p></div>`;
  let nextDay=null; for(let offset=1;offset<=14;offset++) { const date=addDays(today,offset); const lessons=lessonsOnDate(date); if(lessons.length) { nextDay={date,lessons}; break; } }
  q("#nextDayPreview").innerHTML=nextDay ? `<strong>${new Intl.DateTimeFormat("de-DE",{weekday:"long",day:"2-digit",month:"2-digit"}).format(nextDay.date)}</strong>${nextDay.lessons.slice(0,4).map(item=>`<div class="mini-lesson"><span class="time">${timetableTimes[item.row].time}</span><span class="course-color" style="background:${safeCourseColor(item.course)}"></span><div><b>${escapeHtml(item.course.name)} · ${escapeHtml(item.course.subject)}</b><small>${item.canceled?"Fällt aus":escapeHtml(item.room||"ohne Raum")}</small></div></div>`).join("")}` : "";
  let nextLesson=null; for(let offset=0;offset<=21&&!nextLesson;offset++) nextLesson=lessonsOnDate(addDays(today,offset)).find(item=>!item.canceled&&!item.course.organizationOnly);
  q("#nextLessonCard").innerHTML=nextLesson ? `<div><span class="soft-label">Dein nächster Unterricht</span><h2>${escapeHtml(nextLesson.course.name)} · ${escapeHtml(nextLesson.course.subject)}</h2><p>${formatShortDate(nextLesson.date)} · ${nextLesson.row+1}. Stunde · ${escapeHtml(nextLesson.room||"ohne Raum")}${nextLesson.duration===2?" · Doppelstunde":""}</p></div><button class="primary-button" data-open-course="${nextLesson.course.id}">Kurs öffnen <span>→</span></button>` : `<div><span class="soft-label">Dein nächster Unterricht</span><h2>Kein Termin gefunden</h2><p>In den kommenden drei Wochen ist kein Unterricht eingetragen.</p></div><button class="primary-button" data-view-target="timetable">Stundenplan öffnen</button>`;
  const notes=buildNotifications().slice(0,4); q("#dashboardAttentionCount").textContent=notes.length;
  q("#dashboardAttention").innerHTML=notes.length?notes.map(item=>`<div class="notification-item"><span>${item.icon}</span><div><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.detail)}</small></div></div>`).join(""):'<div class="student-empty">Aktuell ist nichts Dringendes offen.</div>';
  const baseLessons=state.timetable.filter(item=>item?.courseId); const teaching=baseLessons.filter(item=>!state.courses.find(course=>course.id===item.courseId)?.organizationOnly);
  q("#weeklyLessonCount").textContent=teaching.reduce((sum,item)=>sum+(item.duration||1),0); q("#weeklyCourseCount").textContent=new Set(teaching.map(item=>item.courseId)).size; q("#weeklyDoubleCount").textContent=teaching.filter(item=>item.duration===2).length;
  const visible=state.courses.filter(course=>!course.organizationOnly); const attention=visible.map(course=>({course,missing:(state.rosters[course.rosterId]||[]).filter(student=>suggestion(student)===null).length})).filter(item=>item.missing);
  q("#gradeAttentionTitle").textContent=attention.length?`${attention.length} ${attention.length===1?"Kurs braucht":"Kurse brauchen"} Aufmerksamkeit`:"Notenstand vollständig";
  q("#gradeAttentionText").textContent=attention.length?`${attention[0].course.name} ${attention[0].course.subject}: ${attention[0].missing} SuS noch ohne Note im ${state.quarter}.`:"Für alle eingetragenen SuS liegt mindestens eine Note vor.";
}

function openNotificationsDialog() {
  const items=buildNotifications(); const dialog=q("#detailDialog");
  dialog.innerHTML=`<div class="dialog-inner"><div class="dialog-head"><div><span class="soft-label">Nur Wichtiges</span><h3>Hinweise</h3></div><button class="close-dialog">×</button></div><div class="notification-list">${items.length?items.map(item=>`<div class="notification-item"><span>${item.icon}</span><div><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.detail)}</small></div></div>`).join(""):'<div class="student-empty">Aktuell ist nichts Dringendes offen.</div>'}</div><div class="dialog-actions"><button class="primary-button close-dialog">Fertig</button></div></div>`;
  dialog.showModal();
}

let pendingBackup=null;
let pendingStudentImport=[];

function openSettingsDialog() {
  const dialog=q("#detailDialog");
  dialog.innerHTML=`<div class="dialog-inner"><div class="dialog-head"><div><span class="soft-label">Persönlich · nur lokal</span><h3>Einstellungen & Daten</h3></div><button class="close-dialog">×</button></div>
    <div class="form-grid"><label class="form-field"><span>Name</span><input id="settingsName" value="${escapeHtml(state.settings.displayName)}"></label><label class="form-field"><span>Kürzel</span><input id="settingsInitials" maxlength="3" value="${escapeHtml(state.settings.initials)}"></label><label class="form-field"><span>Schuljahr</span><input id="settingsSchoolYear" value="${escapeHtml(state.settings.schoolYear)}" placeholder="2026/27"></label><label class="form-field"><span>Aktuelles Quartal</span><select id="settingsQuarter">${["Q1","Q2","Q3","Q4"].map(value=>`<option ${value===state.quarter?"selected":""}>${value}</option>`).join("")}</select></label><label class="form-field full"><span>Quartalsende · optional</span><input type="date" id="settingsQuarterEnd" value="${state.settings.quarterEndDate||""}"></label></div>
    <div class="editor-section"><div class="editor-heading"><h4>Unterrichtszeiten</h4><span class="soft-label">1.–8. Stunde</span></div><div class="lesson-time-grid">${state.settings.lessonTimes.map((time,index)=>`<label class="form-field"><span>${index+1}. Stunde</span><input type="time" data-lesson-time="${index}" value="${time}"></label>`).join("")}</div></div>
    <div class="editor-section"><div class="editor-heading"><h4>App-Schutz</h4><span class="soft-label">optional</span></div><label class="checkbox-field"><input type="checkbox" id="lockEnabled" ${state.settings.lockHash?"checked":""}> PIN-Blickschutz aktivieren</label><div class="form-grid"><label class="form-field full"><span>${state.settings.lockHash?"Neue PIN · leer lassen zum Beibehalten":"PIN · 4 bis 8 Ziffern"}</span><input type="password" inputmode="numeric" maxlength="8" id="settingsPin" placeholder="${state.settings.lockHash?"PIN unverändert":"••••"}"></label></div><div class="form-note">Der Blickschutz verhindert schnelles Mitlesen. Die Gerätesperre und regelmäßige Sicherungen bleiben wichtig.</div>${state.settings.lockHash?'<button class="secondary-button" id="lockNow">Jetzt sperren</button>':""}</div>
    <div class="editor-section"><div class="editor-heading"><h4>Zeitraum abschließen</h4><span class="soft-label">mit Archiv</span></div><div class="backup-actions"><button class="secondary-button" id="closeQuarter">${state.quarter} abschließen</button><button class="secondary-button" id="closeSchoolYear">Schuljahr archivieren</button></div><div class="form-note">Vor jedem Wechsel wird eine unveränderliche Momentaufnahme der Noten und Fehlstunden angelegt.</div>${state.archives.length?`<div class="timetable-entry-list">${state.archives.slice().reverse().slice(0,6).map(item=>`<button data-view-archive="${item.id}"><span>${escapeHtml(item.label)}</span><small>${new Intl.DateTimeFormat("de-DE").format(new Date(item.createdAt))} · ansehen</small></button>`).join("")}</div>`:""}</div>
    <div class="editor-section"><div class="editor-heading"><h4>Datensicherung</h4><span class="soft-label">JSON-Datei</span></div><div class="backup-actions"><button class="secondary-button" id="exportBackup">Sicherung exportieren</button><label class="secondary-button file-button">Sicherung auswählen<input type="file" id="importBackupFile" accept="application/json,.json"></label><button class="secondary-button" id="importBackup" disabled>Importieren</button></div><div class="form-note" id="backupStatus">Die Synchronisierung folgt nach der Testphase. Bis dahin kannst du deine Daten als Datei sichern.</div></div>
    <div class="dialog-actions"><button class="secondary-button close-dialog">Abbrechen</button><button class="primary-button" id="saveSettings">Speichern</button></div></div>`;
  pendingBackup=null; dialog.showModal();
}

async function saveSettings() {
  const lockEnabled=q("#lockEnabled").checked; const pin=q("#settingsPin").value.trim();
  if(lockEnabled&&!state.settings.lockHash&&!/^\d{4,8}$/.test(pin)) { showToast("Bitte eine PIN mit 4 bis 8 Ziffern eingeben"); return; }
  if(pin&&!/^\d{4,8}$/.test(pin)) { showToast("Die PIN darf nur 4 bis 8 Ziffern enthalten"); return; }
  if(!lockEnabled) state.settings.lockHash=""; else if(pin) state.settings.lockHash=await hashPin(pin);
  state.settings.displayName=q("#settingsName").value.trim()||"Ich"; state.settings.initials=(q("#settingsInitials").value.trim()||state.settings.displayName[0]||"I").toUpperCase(); state.settings.schoolYear=q("#settingsSchoolYear").value.trim(); state.settings.quarterEndDate=q("#settingsQuarterEnd").value; state.settings.lessonTimes=qa("[data-lesson-time]").map(input=>input.value||defaultSettings().lessonTimes[Number(input.dataset.lessonTime)]); state.quarter=q("#settingsQuarter").value; timetableTimes=state.settings.lessonTimes.map((time,index)=>({label:String(index+1),time})); saveState(); q("#detailDialog").close(); renderAll(); showToast("Einstellungen gespeichert");
}

function archiveSnapshot(type,label) {
  const courses=state.courses.filter(course=>!course.organizationOnly).map(course=>({id:course.id,name:`${course.name} · ${course.subject}`,students:(state.rosters[course.rosterId]||[]).map(student=>({id:student.id,name:student.name,final:finalGrade(student,course.id,state.quarter),average:suggestion(student,state.quarter),absences:student.absences,grades:structuredClone(student.grades.filter(grade=>grade.schoolYear===state.settings.schoolYear&&(type==="year"||grade.quarter===state.quarter)))}))}));
  return {id:`archive-${Date.now()}`,type,label,schoolYear:state.settings.schoolYear,quarter:state.quarter,createdAt:new Date().toISOString(),courses};
}

function openPeriodCloseDialog(type) {
  const schoolYear=type==="year"; const dialog=q("#detailDialog"); const next=nextSchoolYear(state.settings.schoolYear);
  dialog.innerHTML=`<div class="dialog-inner"><div class="dialog-head"><div><span class="soft-label">Sicherer Wechsel</span><h3>${schoolYear?"Schuljahr archivieren":`${state.quarter} abschließen`}</h3></div><button class="close-dialog">×</button></div><div class="form-note">Noten, Endnoten und Fehlstunden werden zuerst im Archiv gespeichert. Die aktuelle Kurs- und Namensstruktur bleibt erhalten.</div>${schoolYear?`<label class="form-field full"><span>Nächstes Schuljahr</span><input id="nextSchoolYear" value="${escapeHtml(next)}"></label>`:`<p>Danach wird auf <b>${state.quarter==="Q1"?"Q2":state.quarter==="Q2"?"Q3":state.quarter==="Q3"?"Q4":"das nächste Schuljahr"}</b> gewechselt.</p>`}<div class="dialog-actions"><button class="secondary-button close-dialog">Abbrechen</button><button class="primary-button" id="confirmPeriodClose" data-period-type="${type}">${schoolYear?"Archivieren und wechseln":"Quartal abschließen"}</button></div></div>`; if(!dialog.open) dialog.showModal();
}

function nextSchoolYear(value) { const match=String(value).match(/(\d{4})\D+(\d{2,4})/); if(!match) return ""; const first=Number(match[1])+1; return `${first}/${String(first+1).slice(-2)}`; }

function completePeriod(type) {
  if(type==="quarter"&&state.quarter==="Q4") { openPeriodCloseDialog("year"); return; }
  const snapshot=archiveSnapshot(type,type==="year"?`Schuljahr ${state.settings.schoolYear}`:`${state.settings.schoolYear} · ${state.quarter}`); state.archives.push(snapshot);
  if(type==="quarter") {
    const carry=state.quarter==="Q1"||state.quarter==="Q3";
    const handled=new Set(); state.courses.filter(course=>!course.organizationOnly).forEach(course=>(state.rosters[course.rosterId]||[]).forEach(student=>{ const key=`${course.rosterId}-${student.id}`; if(handled.has(key)) return; handled.add(key); student.previous=carry?finalGrade(student,course.id,state.quarter):null; student.absences=0; }));
    state.quarter=state.quarter==="Q1"?"Q2":state.quarter==="Q2"?"Q3":"Q4";
  } else {
    state.settings.schoolYear=q("#nextSchoolYear")?.value.trim()||nextSchoolYear(state.settings.schoolYear); state.quarter="Q1";
    Object.values(state.rosters).forEach(roster=>roster.forEach(student=>{student.previous=null;student.absences=0;})); state.lessonPlans={}; state.seriesByCourse={}; state.finalOverrides={}; state.excused={};
  }
  Object.keys(state.attendance).forEach(key=>{ if(type==="year"||state.attendance[key].quarter===snapshot.quarter) delete state.attendance[key]; }); state.excused={}; state.settings.quarterEndDate=""; saveState(); q("#detailDialog").close(); renderAll(); showToast(`${snapshot.label} wurde archiviert`);
}

function openArchive(id) {
  const item=state.archives.find(candidate=>candidate.id===id); if(!item) return; const dialog=q("#detailDialog");
  dialog.innerHTML=`<div class="dialog-inner"><div class="dialog-head"><div><span class="soft-label">Archiv · nur lesen</span><h3>${escapeHtml(item.label)}</h3></div><button class="close-dialog">×</button></div><div class="notification-list">${item.courses.map(course=>`<details class="archive-course"><summary><b>${escapeHtml(course.name)}</b><small>${course.students.length} SuS · ${course.students.filter(student=>student.final!=null).length} Endnoten</small></summary><div class="archive-students">${course.students.map(student=>`<div><span>${escapeHtml(student.name)}</span><b>Endnote ${student.final??"—"}</b><small>${student.absences} Fehlstd. · ${student.grades.length} Einträge</small></div>`).join("")}</div></details>`).join("")}</div><div class="dialog-actions"><button class="primary-button close-dialog">Schließen</button></div></div>`; if(!dialog.open) dialog.showModal();
}

function exportBackup() {
  state.settings.lastBackupAt=new Date().toISOString(); saveState(); const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}); const link=document.createElement("a"); link.href=URL.createObjectURL(blob); link.download=`lehrerkalender-sicherung-${dateKey(today)}.json`; link.click(); setTimeout(()=>URL.revokeObjectURL(link.href),1000); renderTopbar(); renderToday(); showToast("Datensicherung erstellt");
}

async function prepareBackup(file) {
  try { const parsed=JSON.parse(await file.text()); if(!parsed.courses || !parsed.rosters || !parsed.timetable) throw new Error(); pendingBackup=parsed; q("#importBackup").disabled=false; q("#backupStatus").textContent=`Sicherung „${file.name}“ erkannt. Erst „Importieren“ ersetzt die lokalen Daten.`; }
  catch { pendingBackup=null; q("#importBackup").disabled=true; q("#backupStatus").textContent="Diese Datei ist keine gültige Lehrerkalender-Sicherung."; }
}

function importBackup() {
  if(!pendingBackup) return; state=normalizeAcademicData({...defaultState(),...pendingBackup,settings:{...defaultSettings(),...(pendingBackup.settings||{})}}); timetableTimes=state.settings.lessonTimes.map((time,index)=>({label:String(index+1),time})); saveState(); q("#detailDialog").close(); renderAll(); showToast("Datensicherung importiert");
}

function switchView(view) {
  qa(".view").forEach(el => el.classList.toggle("active", el.id === `view-${view}`));
  qa("[data-view]").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  const titles = { today:"Guten Morgen", timetable:"Deine Unterrichtswoche", courses:"Klassen & Kurse", grades:"Leistungen im Blick" };
  q("#pageTitle").textContent = titles[view];
  window.scrollTo({top:0, behavior:"smooth"});
}

function weightedAverage(grades, category, quarter=state.quarter) {
  const rows = grades.filter(g => g.c === category && g.quarter === quarter && g.schoolYear === state.settings.schoolYear);
  if (!rows.length) return null;
  return rows.reduce((sum,g) => sum + g.v * g.w, 0) / rows.reduce((sum,g) => sum + g.w, 0);
}

function suggestion(student, quarter=state.quarter) {
  const oral = weightedAverage(student.grades, "oral", quarter);
  const other = weightedAverage(student.grades, "other", quarter);
  const written = weightedAverage(student.grades, "written", quarter);
  let oralBlock = null;
  if (oral !== null && other !== null) oralBlock = oral * .8 + other * .2;
  else if (oral !== null) oralBlock = oral;
  else if (other !== null) oralBlock = other;
  if (written !== null && oralBlock !== null) return written * .5 + oralBlock * .5;
  return written ?? oralBlock;
}

function finalGrade(student, courseId=state.courseId, quarter=state.quarter) {
  const key = `${state.settings.schoolYear}-${courseId}-${quarter}-${student.id}`; const legacyKey=`${courseId}-${quarter}-${student.id}`;
  if (state.finalOverrides[key] || state.finalOverrides[legacyKey]) return Number(state.finalOverrides[key]||state.finalOverrides[legacyKey]);
  let calculated = suggestion(student, quarter);
  if(calculated!==null && previousQuarter(quarter) && student.previous!=null) calculated=(Number(student.previous)+calculated)/2;
  return calculated === null ? null : Math.round(calculated);
}

function previousQuarter(quarter) {
  return quarter === "Q2" ? "Q1" : quarter === "Q4" ? "Q3" : null;
}

function renderCourses() {
  const visibleCourses=state.courses.filter(course=>!course.timetableOnly);
  q("#courseCountLabel").textContent = `${visibleCourses.length} aktive Kurse`;
  q("#courseGrid").innerHTML = visibleCourses.map(c => {
    const studentCount = (state.rosters[c.rosterId] || []).length;
    const mode = c.organization === "class" ? "Sek I · Klassenverband" : `Sek II · ${c.courseType || "Kurs"}`;
    return `
    <article class="course-card panel" style="--course-color:${c.color}" data-course-card="${c.id}">
      <span class="soft-label">${mode}</span><h3>${c.name} · ${c.subject}</h3>
      <p>${c.room || "Kein Raum"}</p><div class="course-meta"><span>${studentCount} SuS</span><span>${c.organization === "class" ? "Liste geteilt" : "Eigene Kursliste"}</span></div>
      <div class="course-card-actions"><button data-open-course="${c.id}">Noten öffnen</button><button data-manage-course="${c.id}">Verwalten</button></div>
    </article>`;
  }).join("");
  const selectable = state.courses.filter(c=>!c.organizationOnly);
  if (!selectable.some(c => c.id === state.courseId)) state.courseId = selectable[0]?.id;
  q("#courseSelect").innerHTML = selectable.map(c => `<option value="${c.id}" ${c.id===state.courseId?"selected":""}>${c.name} · ${c.subject}</option>`).join("");
}

let timetableTimes = state.settings.lessonTimes.map((time,index)=>({label:String(index+1),time}));
const timetableDays = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag"];
const schoolBreaks = [{from:"2026-10-12",to:"2026-10-24"}];

function dateKey(date) { return date.toISOString().slice(0,10); }
function addDays(date, days) { const copy=new Date(date); copy.setDate(copy.getDate()+days); return copy; }
function baseMonday() {
  const date=new Date(today); date.setHours(12,0,0,0); const day=date.getDay();
  date.setDate(date.getDate() + (day === 0 ? 1 : 1-day)); return date;
}
function displayedMonday() { return addDays(baseMonday(), state.weekOffset * 7); }
function lessonKey(date, courseId, row) { return `${dateKey(date)}|${courseId}|${row}`; }
function isSchoolFree(date) { const key=dateKey(date); return schoolBreaks.some(period=>key>=period.from&&key<=period.to); }

function scheduledOccurrences(courseId, startDate, weeks=52) {
  const start=new Date(`${startDate}T12:00:00`); const monday=baseMonday();
  const first=addDays(monday,-14); const occurrences=[];
  for(let week=0;week<weeks;week++) for(let row=0;row<timetableTimes.length;row++) for(let col=0;col<5;col++) {
    const item=state.timetable[row*5+col]; if(item?.courseId!==courseId) continue;
    const date=addDays(first,week*7+col); if(date<start || isSchoolFree(date)) continue;
    occurrences.push({date,row,col,duration:item.duration||1,key:lessonKey(date,courseId,row)});
  }
  return occurrences.sort((a,b)=>a.date-b.date || a.row-b.row);
}

function buildAssignments(courseId) {
  const series=state.seriesByCourse[courseId]; if(!series?.units?.length) return {};
  const remaining=new Map(series.units.map(unit=>[unit.id,Number(unit.hours)])); const assignments={};
  for(const occurrence of scheduledOccurrences(courseId,series.startDate)) {
    const saved=state.lessonPlans[occurrence.key] || {};
    if(saved.status==="canceled" || saved.status==="unplanned") { assignments[occurrence.key]=[]; continue; }
    if(saved.manualAllocations?.length) {
      const selected=saved.manualAllocations.filter(Boolean);
      assignments[occurrence.key]=selected;
      selected.forEach(id=>remaining.set(id,Math.max(0,(remaining.get(id)||0)-1)));
      const maxIndex=Math.max(...selected.map(id=>series.units.findIndex(unit=>unit.id===id)));
      series.units.slice(0,maxIndex).forEach(unit=>remaining.set(unit.id,0));
      continue;
    }
    const slots=[];
    for(let hour=0;hour<occurrence.duration;hour++) {
      const unit=series.units.find(candidate=>(remaining.get(candidate.id)||0)>0); if(!unit) break;
      slots.push(unit.id); remaining.set(unit.id,remaining.get(unit.id)-1);
    }
    assignments[occurrence.key]=slots;
  }
  return assignments;
}

function homeworkDueFor(date, courseId, row) {
  const hasDueHomework=Object.values(state.lessonPlans).some(plan=>plan.homework?.trim() && plan.homeworkDue===dateKey(date) && plan.courseId===courseId);
  if(!hasDueHomework) return false;
  const col=date.getDay()-1; const firstRow=timetableTimes.findIndex((_,candidateRow)=>state.timetable[candidateRow*5+col]?.courseId===courseId);
  return row===firstRow;
}

function baseScheduleAt(dateString,row) {
  const date=new Date(`${dateString}T12:00:00`); const col=date.getDay()-1;
  if(col<0 || col>4) return {item:null,row};
  const raw=state.timetable[row*5+col];
  if(raw?.continuesFrom!==undefined) return {item:state.timetable[raw.continuesFrom],row:Math.floor(raw.continuesFrom/5)};
  return {item:raw,row};
}

function scheduleChangeKey(dateString,row) { return `${dateString}|${row}`; }

function renderTimetable() {
  const days=timetableDays; const monday=displayedMonday();
  const rangeEnd=addDays(monday,4); q("#timetableWeekLabel").textContent=`${new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"short"}).format(monday)} – ${new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"short",year:"numeric"}).format(rangeEnd)}`;
  const assignmentCache={}; state.courses.forEach(course=>assignmentCache[course.id]=buildAssignments(course.id));
  let html=`<div></div>${days.map((day,col)=>`<div class="tt-head">${day}<span class="tt-date">${new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit"}).format(addDays(monday,col))}</span></div>`).join("")}`;
  timetableTimes.forEach((time,row)=>{
    html+=`<div class="tt-time">${time.label}<small>${time.time}</small></div>`;
    for(let col=0;col<5;col++) {
      const date=addDays(monday,col); const dateString=dateKey(date); const rawItem=state.timetable[row*5+col]; const continuation=rawItem?.continuesFrom!==undefined; const baseItem=continuation?state.timetable[rawItem.continuesFrom]:rawItem; const lessonRow=continuation?Math.floor(rawItem.continuesFrom/5):row; const change=state.scheduleChanges[scheduleChangeKey(dateString,lessonRow)];
      if(!baseItem && !change?.courseId) { html+='<div class="tt-cell"></div>'; continue; }
      const replacementCourse=change?.courseId?state.courses.find(candidate=>candidate.id===change.courseId):null;
      const item=replacementCourse?{courseId:replacementCourse.id,room:change.room,duration:baseItem?.duration||1}:baseItem;
      const course=state.courses.find(c=>c.id===item?.courseId); if(!course) { html+='<div class="tt-cell"></div>'; continue; }
      const key=lessonKey(date,course.id,lessonRow); const plan=state.lessonPlans[key]||{}; const ids=assignmentCache[course.id]?.[key]||[]; const series=state.seriesByCourse[course.id];
      const topics=ids.map(id=>series?.units.find(unit=>unit.id===id)?.title).filter(Boolean); const status=change?.kind==="cancel"?"canceled":(plan.status || (topics.length?"planned":"")); const book=homeworkDueFor(date,course.id,row);
      const doubleClass=item.duration===2?(continuation?"double-end":"double-start"):"";
      const shownRoom=change?.kind==="room"?change.room:(item.room ?? course.room ?? ""); const changeLabel=change?.kind==="cancel"?"Ausfall":change?.kind==="room"?`Raum → ${escapeHtml(change.room)}`:change?.kind==="replacement"?"Vertretung / zusätzlich":"";
      html+=`<div class="tt-cell lesson course-tone ${status} ${doubleClass} ${change?"has-change":""}" style="--lesson-color:${safeCourseColor(course)}" data-lesson-key="${key}" data-course-id="${course.id}" data-row="${lessonRow}" data-duration="${item.duration||1}" data-date="${dateString}">${continuation?`<span class="double-continuation">Fortsetzung · Doppelstunde</span>`:`<b>${course.name} · ${course.subject}</b><span>${escapeHtml(shownRoom)} · ${(item.duration||1)}×</span>${changeLabel?`<span class="change-badge">${changeLabel}</span>`:""}${topics.length?`<div class="lesson-topics">${topics.map(topic=>`<span class="topic-segment">${escapeHtml(topic)}</span>`).join("")}</div>`:""}<span class="lesson-markers">${book?'<i title="Hausaufgabe fällig">📖</i>':""}${status==="done"?'<i class="done-check">✓</i>':""}</span>`}</div>`;
    }
  });
  q("#timetableGrid").innerHTML=html;
  const legendCourses=state.courses.filter(course=>state.timetable.some(item=>item?.courseId===course.id));
  q("#timetableLegend").innerHTML=legendCourses.map(course=>`<span><i style="background:${safeCourseColor(course)}"></i>${escapeHtml(course.name)} · ${escapeHtml(course.subject)}</span>`).join("");
}

function renderStudents() {
  const table = q(".grade-table");
  const students = currentStudents();
  q("#studentRows").innerHTML = students.map(student => {
    const avg = suggestion(student);
    const final = finalGrade(student);
    const priorQuarter = previousQuarter(state.quarter);
    const semester = priorQuarter && student.previous != null && final != null ? String(final) : null;
    const quarterGrades=student.grades.filter(grade=>grade.quarter===state.quarter&&grade.schoolYear===state.settings.schoolYear);
    const attendanceRows=Object.entries(state.attendance).filter(([,entry])=>entry.courseId===state.courseId&&entry.studentId===student.id&&entry.quarter===state.quarter&&entry.schoolYear===state.settings.schoolYear);
    const detail = expandedStudent === student.id ? `
      <div class="student-detail">
        <div><span class="control-label">Notenverlauf · ${state.quarter}</span><div class="history-chips">${quarterGrades.length ? quarterGrades.map(g=>`<span class="history-chip">${labelCategory(g.c)}${g.type ? ` · ${g.type}` : ""} <b>${g.v}${g.w===2?" · 2×":""}</b><button class="text-button" data-edit-grade="${g.id}" data-student-id="${student.id}">Ändern</button></span>`).join("") : '<span class="history-chip">Noch keine Noten</span>'}</div>${attendanceRows.length?`<div class="history-chips">${attendanceRows.map(([key,entry])=>`<span class="history-chip">Abwesenheit · ${escapeHtml(entry.date||"ohne Datum")} <b>${entry.hours} Std.</b><button class="text-button danger-text" data-delete-attendance="${escapeHtml(key)}" data-student-id="${student.id}">Aufheben</button></span>`).join("")}</div>`:""}</div>
        <label class="final-control">Pädagogische Endnote <select data-final-student="${student.id}"><option value="">—</option>${[1,2,3,4,5,6].map(n=>`<option ${n===final?"selected":""}>${n}</option>`).join("")}</select><span class="semester">${semester ? `Halbjahr: ${semester}` : "Kein übertragener Halbjahreswert"}</span></label>
      </div>` : "";
    return `<div class="student-row" data-student="${student.id}">
      <div class="student-name"><b>${student.name}</b><small>${student.absences} Fehlstd. · ${quarterGrades.length} Einträge in ${state.quarter}</small></div>
      <div class="grade-value previous-cell">${priorQuarter && student.previous != null ? student.previous : "—"}<small>${priorQuarter || "Neustart"}</small></div>
      <div class="grade-value">${avg === null ? "—" : avg.toFixed(2).replace(".",",")}<small>Vorschlag ${final ?? "—"}</small></div>
      <div class="grade-buttons">${[1,2,3,4,5,6].map(n=>`<button data-add-grade="${n}" data-student-id="${student.id}" aria-label="Note ${n} für ${student.name}">${n}</button>`).join("")}<button class="absence-button ${activeEntryArea === "written" ? "hidden" : ""}" data-absent="${student.id}">Abw.</button></div>
      <button class="more-button" data-more="${student.id}" aria-label="Zusatzmenü für ${student.name}">•••</button>${detail}
    </div>`;
  }).join("");
  table.classList.toggle("show-previous", q("#togglePrevious").dataset.visible === "true");
  const open = students.reduce((s,x)=>s+x.absences,0) - students.reduce((s,x)=>s+Number(state.excused[`${state.courseId}-${x.id}`]||0),0);
  q("#absenceSummary").textContent = `${Math.max(0,open)} offen`;
}

function labelCategory(c) { return ({oral:"Mündl.",written:"Schriftl.",other:"Sonst."})[c]; }

function syncEntryControls() {
  const isWritten = activeEntryArea === "written";
  q("#lessonCategoryGroup").classList.toggle("hidden", isWritten);
  q("#lessonWeightGroup").classList.toggle("hidden", isWritten);
  q("#writtenTypeGroup").classList.toggle("hidden", !isWritten);
  q("#lessonWeightLabel").textContent = isWritten ? activeWrittenType : activeWeight === 2 ? "Doppelstunde · 2×" : "Einzelstunde · 1×";
  q("#lessonWeightLabel").nextElementSibling.textContent = isWritten ? "Eigener schriftlicher Reiter" : "Aus Stundenplan übernommen";
}

function escapeHtml(value="") {
  return String(value).replace(/[&<>"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[char]);
}

function newStudent(name) {
  return { id: Date.now() + Math.floor(Math.random() * 100000), name: name.trim(), previous: null, grades: [], absences: 0 };
}

function courseFormFields(course={}) {
  const isCourse = course.organization === "course";
  return `<div class="form-grid">
    <label class="form-field"><span>${isCourse ? "Jahrgang" : "Klasse/Lerngruppe"}</span><input id="courseNameInput" value="${escapeHtml(course.name || "")}" placeholder="z. B. ${isCourse ? "Q1" : "9b"}"></label>
    <label class="form-field"><span>Fach</span><input id="courseSubjectInput" value="${escapeHtml(course.subject || "")}" placeholder="z. B. Biologie"></label>
    <label class="form-field"><span>Raum</span><input id="courseRoomInput" value="${escapeHtml(course.room || "")}" placeholder="optional"></label>
    <label class="form-field ${isCourse ? "" : "hidden"}" id="courseTypeField"><span>Kursart</span><select id="courseTypeInput"><option ${course.courseType === "Grundkurs" ? "selected" : ""}>Grundkurs</option><option ${course.courseType === "Leistungskurs" ? "selected" : ""}>Leistungskurs</option></select></label>
    <label class="checkbox-field"><input type="checkbox" id="courseWrittenInput" ${course.written ? "checked" : ""}> Schriftliche Leistungen vorgesehen</label>
  </div>`;
}

function openCreateCourse() {
  const dialog = q("#detailDialog");
  dialog.innerHTML = `<div class="dialog-inner"><div class="dialog-head"><div><span class="soft-label">Neuer Kurs</span><h3>Kurs anlegen</h3></div><button class="close-dialog">×</button></div>
    <div class="form-grid">
      <label class="form-field full"><span>Organisationsform</span><select id="organizationInput"><option value="class">Sek I – Klassenverband</option><option value="course">Sek II – Kurssystem</option></select></label>
    </div>
    <div id="newCourseFields">${courseFormFields({organization:"class",written:true})}</div>
    <div class="form-note" id="organizationNote">Kurse derselben Klasse verwenden automatisch dieselbe SuS-Liste.</div>
    <div class="editor-section"><div class="editor-heading"><h4>SuS hinzufügen</h4><span class="soft-label">optional</span></div>
      <label class="form-field full"><span>Eine Person pro Zeile</span><textarea id="newCourseStudents" placeholder="Alex B.&#10;Kim M."></textarea></label>${studentImportControls()}
    </div>
    <div class="dialog-actions"><button class="secondary-button close-dialog">Abbrechen</button><button class="primary-button" id="createCourseSave">Kurs anlegen</button></div></div>`;
  pendingStudentImport=[]; dialog.showModal();
}

function refreshNewCourseFields() {
  const organization = q("#organizationInput").value;
  q("#newCourseFields").innerHTML = courseFormFields({organization,written:true});
  q("#organizationNote").textContent = organization === "class" ? "Kurse derselben Klasse verwenden automatisch dieselbe SuS-Liste." : "Dieser Oberstufenkurs erhält eine eigene, unabhängige SuS-Liste.";
}

function parseStudentNames(value) {
  return value.split(/[\n;,]+/).map(name => name.trim()).filter(Boolean);
}

async function prepareStudentImport(file) {
  const text=(await file.text()).replace(/^\uFEFF/,""); const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  if(!lines.length) { pendingStudentImport=[]; q("#studentImportStatus").textContent="Die Datei enthält keine Namen."; return; }
  const delimiter=lines[0].includes(";")?";":lines[0].includes("\t")?"\t":lines[0].includes(",")?",":null;
  let rows=lines.map(line=>delimiter?line.split(delimiter).map(cell=>cell.trim().replace(/^"|"$/g,"")):[line]);
  const header=rows[0].map(cell=>cell.toLocaleLowerCase("de")); const hasHeader=header.some(cell=>/name|vorname|nachname|schüler/.test(cell));
  const first=header.findIndex(cell=>cell.includes("vorname")); const last=header.findIndex(cell=>cell.includes("nachname")); if(hasHeader) rows=rows.slice(1);
  pendingStudentImport=rows.map(cells=>first>=0&&last>=0?`${cells[first]||""} ${cells[last]||""}`.trim():cells.filter(Boolean).slice(0,2).join(" ").trim()).filter(Boolean);
  q("#studentImportStatus").textContent=`${pendingStudentImport.length} Namen aus „${file.name}“ erkannt. Sie werden beim Speichern ergänzt.`;
}

function studentImportControls() { return `<div class="backup-actions"><label class="secondary-button file-button">CSV/TXT auswählen<input type="file" id="studentImportFile" accept=".csv,.txt,text/csv,text/plain"></label></div><div class="form-note" id="studentImportStatus">Alternativ kannst du eine vorhandene Namensliste als CSV oder Textdatei einlesen.</div>`; }

function addUniqueStudents(roster, names) {
  const existing = new Set(roster.map(student => student.name.toLocaleLowerCase("de")));
  names.forEach(name => {
    const key = name.toLocaleLowerCase("de");
    if (!existing.has(key)) { roster.push(newStudent(name)); existing.add(key); }
  });
}

function createCourseFromDialog() {
  const organization = q("#organizationInput").value;
  const name = q("#courseNameInput").value.trim();
  const subject = q("#courseSubjectInput").value.trim();
  if (!name || !subject) { showToast("Bitte Lerngruppe/Jahrgang und Fach eintragen"); return; }
  const id = `course-${Date.now()}`;
  let rosterId;
  if (organization === "class") {
    rosterId = state.courses.find(c => c.organization === "class" && c.name.toLowerCase() === name.toLowerCase())?.rosterId || `class-${name.toLowerCase().replace(/[^a-z0-9]+/g,"-")}-${Date.now()}`;
  } else rosterId = `course-${Date.now()}`;
  if (!state.rosters[rosterId]) state.rosters[rosterId] = [];
  addUniqueStudents(state.rosters[rosterId], [...parseStudentNames(q("#newCourseStudents").value),...pendingStudentImport]);
  state.courses.push({ id, name, subject, room:q("#courseRoomInput").value.trim(), color:nextCourseColor(), organization, courseType:organization === "course" ? q("#courseTypeInput").value : undefined, rosterId, written:q("#courseWrittenInput").checked });
  state.courseId = id; saveState(); q("#detailDialog").close(); renderCourses(); renderStudents(); showToast(`${name} · ${subject} wurde angelegt`);
}

function openManageCourse(courseId) {
  const course = state.courses.find(c => c.id === courseId);
  const students = state.rosters[course.rosterId] || [];
  const dialog = q("#detailDialog");
  const mode = course.organization === "class" ? "Sek I · gemeinsame Klassenliste" : "Sek II · unabhängige Kursliste";
  dialog.innerHTML = `<div class="dialog-inner"><div class="dialog-head"><div><span class="soft-label">${mode}</span><h3>${escapeHtml(course.name)} · ${escapeHtml(course.subject)}</h3></div><button class="close-dialog">×</button></div>
    <div class="form-note">${course.organization === "class" ? "Änderungen an Namen gelten in allen Kursen dieser Klasse." : "Diese Liste gehört ausschließlich zu diesem Oberstufenkurs."}</div>
    <div data-edit-course="${course.id}">${courseFormFields(course)}</div>
    <div class="editor-section"><div class="editor-heading"><h4>SuS bearbeiten</h4><span class="soft-label">${students.length} Personen</span></div>
      <div class="student-editor-list">${students.length ? students.map((student,index)=>`<label class="student-editor-row"><span>${index+1}</span><input data-edit-student="${student.id}" value="${escapeHtml(student.name)}"></label>`).join("") : '<div class="student-empty">Noch keine SuS eingetragen</div>'}</div>
      <label class="form-field full" style="margin-top:12px"><span>Weitere Namen · eine Person pro Zeile</span><textarea id="additionalStudents" placeholder="Namen hier einfügen"></textarea></label>${studentImportControls()}
    </div>
    <div class="dialog-actions"><button class="secondary-button close-dialog">Abbrechen</button><button class="primary-button" id="saveCourseChanges" data-course-id="${course.id}">Speichern</button></div></div>`;
  pendingStudentImport=[]; dialog.showModal();
}

function saveCourseChanges(courseId) {
  const course = state.courses.find(c => c.id === courseId);
  const newName = q("#courseNameInput").value.trim() || course.name;
  if (course.organization === "class") state.courses.filter(c => c.rosterId === course.rosterId).forEach(c => { c.name = newName; });
  else course.name = newName;
  course.subject = q("#courseSubjectInput").value.trim() || course.subject;
  course.room = q("#courseRoomInput").value.trim();
  course.written = q("#courseWrittenInput").checked;
  if (course.organization === "course") course.courseType = q("#courseTypeInput").value;
  const students = state.rosters[course.rosterId];
  qa("[data-edit-student]").forEach(input => { const student=students.find(s=>s.id===Number(input.dataset.editStudent)); if (student && input.value.trim()) student.name=input.value.trim(); });
  addUniqueStudents(students, [...parseStudentNames(q("#additionalStudents").value),...pendingStudentImport]);
  saveState(); q("#detailDialog").close(); renderCourses(); renderStudents(); showToast("Kurs und SuS-Liste aktualisiert");
}

function seriesRow(unit={}, index=0) {
  return `<div class="series-unit-row" data-unit-id="${unit.id||""}"><span>${index+1}</span><input class="series-title" value="${escapeHtml(unit.title||"")}" placeholder="Bezeichnung der UE"><input class="series-hours" type="number" min="1" max="30" value="${unit.hours||1}" aria-label="Stundenanzahl"></div>`;
}

function openSeriesDialog(courseId=null) {
  const course=courseId ? state.courses.find(candidate=>candidate.id===courseId) : currentCourse(); const series=state.seriesByCourse[course.id] || {startDate:dateKey(displayedMonday()),units:[]}; const dialog=q("#detailDialog");
  dialog.innerHTML=`<div class="dialog-inner"><div class="dialog-head"><div><span class="soft-label">${escapeHtml(course.name)} · ${escapeHtml(course.subject)}</span><h3>Unterrichtsreihe</h3></div><button class="close-dialog">×</button></div>
    <div class="form-note">Nur Reihenfolge und Stundenumfang festlegen. Die Verteilung auf deine Unterrichtstermine erfolgt automatisch.</div>
    <label class="form-field" style="margin-top:14px"><span>Startdatum der ersten UE</span><input type="date" id="seriesStartDate" value="${series.startDate}"></label>
    <div class="editor-section"><div class="editor-heading"><h4>Unterrichtseinheiten</h4><span class="soft-label">Stunden flexibel verteilbar</span></div><div class="series-list" id="seriesList">${series.units.length?series.units.map(seriesRow).join(""):seriesRow({},0)}</div><button class="secondary-button series-add" id="addSeriesUnit">＋ UE hinzufügen</button></div>
    <div class="dialog-actions"><button class="secondary-button close-dialog">Abbrechen</button><button class="primary-button" id="saveSeries" data-course-id="${course.id}">Speichern</button></div></div>`;
  if(!dialog.open) dialog.showModal();
}

function addSeriesUnitRow() {
  const list=q("#seriesList"); list.insertAdjacentHTML("beforeend",seriesRow({},qa(".series-unit-row",list).length));
}

function saveSeries(courseId) {
  const units=qa(".series-unit-row").map((row,index)=>({id:row.dataset.unitId||`${courseId}-u-${Date.now()}-${index}`,title:q(".series-title",row).value.trim(),hours:Math.max(1,Number(q(".series-hours",row).value)||1)})).filter(unit=>unit.title);
  if(!units.length) { showToast("Bitte mindestens eine UE eintragen"); return; }
  state.seriesByCourse[courseId]={startDate:q("#seriesStartDate").value||dateKey(displayedMonday()),units}; saveState(); q("#detailDialog").close(); renderTimetable(); showToast("Unterrichtsreihe wurde verteilt");
}

function nextCourseDate(courseId, afterDate) {
  return scheduledOccurrences(courseId,dateKey(addDays(new Date(`${afterDate}T12:00:00`),1)),20)[0]?.date;
}

function openLessonDialog(cell) {
  const courseId=cell.dataset.courseId; const course=state.courses.find(c=>c.id===courseId); const row=Number(cell.dataset.row); const key=cell.dataset.lessonKey; const date=cell.dataset.date; const duration=Number(cell.dataset.duration)||1; const saved=state.lessonPlans[key]||{}; const series=state.seriesByCourse[courseId]; const automatic=buildAssignments(courseId)[key]||[]; const selected=saved.manualAllocations||automatic;
  const options=`<option value="">Keine UE</option>${(series?.units||[]).map(unit=>`<option value="${unit.id}">${escapeHtml(unit.title)}</option>`).join("")}`;
  const slots=Array.from({length:duration},(_,index)=>`<label class="lesson-slot"><span>${duration===2?`${index+1}. Stunde`:"UE"}</span><select class="lesson-unit-select">${options}</select></label>`).join("");
  const due=saved.homeworkDue || (nextCourseDate(courseId,date)?dateKey(nextCourseDate(courseId,date)):""); const dialog=q("#detailDialog");
  dialog.innerHTML=`<div class="dialog-inner"><div class="dialog-head"><div><span class="soft-label">${new Intl.DateTimeFormat("de-DE",{weekday:"long",day:"2-digit",month:"long"}).format(new Date(`${date}T12:00:00`))}</span><h3>${escapeHtml(course.name)} · ${escapeHtml(course.subject)}</h3></div><button class="close-dialog">×</button></div>
    <div class="lesson-plan-slots">${series?.units?.length?slots:`<div class="form-note">Für diesen Kurs ist noch keine Unterrichtsreihe angelegt.</div><button class="secondary-button" data-open-series-course="${courseId}">Unterrichtsreihe anlegen</button>`}</div>
    <div class="control-group status-control"><span class="control-label">Status</span><div class="segmented" id="lessonStatusControl"><button data-status="unplanned">Ungeplant</button><button data-status="planned">Geplant</button><button data-status="done">Durchgeführt</button><button data-status="canceled">Ausgefallen</button></div></div>
    <div class="homework-block"><div class="editor-heading"><h4>Hausaufgabe</h4><span class="soft-label">optional · nur diese Stunde</span></div><label class="form-field"><span>Aufgabe</span><input id="homeworkText" value="${escapeHtml(saved.homework||"")}" placeholder="z. B. Arbeitsblatt beenden"></label><label class="form-field" style="margin-top:10px"><span>Fällig am</span><input type="date" id="homeworkDue" value="${due}"></label></div>
    <div class="dialog-actions">${course.organizationOnly?"":`<button class="secondary-button lesson-grade-action" data-open-lesson-grades data-lesson-key="${key}" data-course-id="${courseId}" data-date="${date}" data-duration="${duration}">Mitarbeit erfassen</button>`}<button class="secondary-button close-dialog">Abbrechen</button><button class="primary-button" id="saveLessonPlan" data-lesson-key="${key}" data-course-id="${courseId}">Speichern</button></div></div>`;
  qa(".lesson-unit-select",dialog).forEach((select,index)=>{ select.value=selected[index]||""; });
  const status=saved.status||(automatic.length?"planned":"unplanned"); qa("#lessonStatusControl button",dialog).forEach(button=>button.classList.toggle("active",button.dataset.status===status)); dialog.dataset.lessonStatus=status; dialog.showModal();
}

function saveLessonPlan(button,{close=true,notify=true}={}) {
  const dialog=q("#detailDialog"); const key=button.dataset.lessonKey; const allocations=qa(".lesson-unit-select",dialog).map(select=>select.value).filter(Boolean); const homework=q("#homeworkText").value.trim();
  state.lessonPlans[key]={...(state.lessonPlans[key]||{}),courseId:button.dataset.courseId,status:dialog.dataset.lessonStatus||"planned",manualAllocations:allocations,homework,homeworkDue:homework?q("#homeworkDue").value:""}; saveState(); if(close) dialog.close(); renderTimetable(); if(notify) showToast("Unterrichtsstunde gespeichert");
}

function lessonAttendanceKey(lessonKeyValue,studentId) { return `${lessonKeyValue}|${studentId}`; }

function lessonGradeRows(courseId,lessonKeyValue,duration) {
  const course=state.courses.find(candidate=>candidate.id===courseId); const students=state.rosters[course.rosterId]||[];
  if(!students.length) return '<div class="student-empty">Für diesen Kurs sind noch keine SuS eingetragen.</div>';
  return students.map(student=>{
    const grade=student.grades.find(entry=>entry.lessonKey===lessonKeyValue); const absent=state.attendance[lessonAttendanceKey(lessonKeyValue,student.id)];
    const status=absent?`Abwesend · ${absent.hours} Fehlstunde${absent.hours===1?"":"n"}`:grade?`${labelCategory(grade.c)} · Note ${grade.v} · ${grade.w}×`:"Noch kein Eintrag";
    return `<div class="lesson-grade-row ${absent?"is-absent":""}" data-lesson-student="${student.id}"><div class="lesson-grade-name"><b>${escapeHtml(student.name)}</b><small>${status}</small></div><div class="lesson-grade-buttons">${[1,2,3,4,5,6].map(note=>`<button class="${grade?.v===note?"active":""}" data-lesson-grade="${note}" data-student-id="${student.id}">${note}</button>`).join("")}<button class="absence-button ${absent?"active":""}" data-lesson-absent="${student.id}">${absent?"Anwesend":"Abw."}</button></div></div>`;
  }).join("");
}

function openLessonGradeDialog({courseId,lessonKeyValue,date,duration}) {
  const course=state.courses.find(candidate=>candidate.id===courseId); state.courseId=courseId; saveState(); const dialog=q("#detailDialog");
  dialog.innerHTML=`<div class="dialog-inner"><div class="dialog-head"><div><span class="soft-label">${new Intl.DateTimeFormat("de-DE",{weekday:"long",day:"2-digit",month:"long"}).format(new Date(`${date}T12:00:00`))} · ${duration===2?"Doppelstunde · 2×":"Einzelstunde · 1×"}</span><h3>Mitarbeit · ${escapeHtml(course.name)} ${escapeHtml(course.subject)}</h3></div><button class="close-dialog">×</button></div>
    <div class="lesson-grade-toolbar"><div class="control-group"><span class="control-label">Art des Eintrags</span><div class="segmented" id="timetableGradeCategory"><button class="active" data-lesson-grade-category="oral">Mündlich</button><button data-lesson-grade-category="other">Sonstige</button></div></div><div class="form-note">„Sonstige“ ersetzt für die ausgewählte Person die mündliche Note dieser Stunde.</div></div>
    <div class="lesson-grade-list" id="lessonGradeRows">${lessonGradeRows(courseId,lessonKeyValue,duration)}</div>
    <div class="dialog-actions"><button class="primary-button close-dialog">Fertig</button></div></div>`;
  dialog.dataset.gradeCourseId=courseId; dialog.dataset.gradeLessonKey=lessonKeyValue; dialog.dataset.gradeDuration=String(duration); dialog.dataset.gradeCategory="oral";
  if(!dialog.open) dialog.showModal();
}

function addLessonGrade(note,studentId) {
  const dialog=q("#detailDialog"); const course=state.courses.find(candidate=>candidate.id===dialog.dataset.gradeCourseId); const student=state.rosters[course.rosterId].find(candidate=>candidate.id===studentId); const key=dialog.dataset.gradeLessonKey; const duration=Number(dialog.dataset.gradeDuration); const attendanceKey=lessonAttendanceKey(key,studentId); const absent=state.attendance[attendanceKey];
  if(absent) { student.absences=Math.max(0,student.absences-absent.hours); delete state.attendance[attendanceKey]; }
  const existing=student.grades.find(entry=>entry.lessonKey===key); const entry={id:existing?.id||newGradeId(),v:note,c:dialog.dataset.gradeCategory||"oral",w:duration,lessonKey:key,date:key.split("|")[0],quarter:state.quarter,schoolYear:state.settings.schoolYear};
  if(existing) Object.assign(existing,entry); else student.grades.push(entry);
  saveState(); q("#lessonGradeRows").innerHTML=lessonGradeRows(course.id,key,duration); showToast(`Note ${note} für ${student.name} gespeichert`);
}

function toggleLessonAbsence(studentId) {
  const dialog=q("#detailDialog"); const course=state.courses.find(candidate=>candidate.id===dialog.dataset.gradeCourseId); const student=state.rosters[course.rosterId].find(candidate=>candidate.id===studentId); const key=dialog.dataset.gradeLessonKey; const duration=Number(dialog.dataset.gradeDuration); const attendanceKey=lessonAttendanceKey(key,studentId); const absent=state.attendance[attendanceKey];
  if(absent) { student.absences=Math.max(0,student.absences-absent.hours); delete state.attendance[attendanceKey]; }
  else { state.attendance[attendanceKey]={hours:duration,courseId:course.id,studentId,date:key.split("|")[0],quarter:state.quarter,schoolYear:state.settings.schoolYear}; student.absences+=duration; student.grades=student.grades.filter(entry=>entry.lessonKey!==key); }
  saveState(); q("#lessonGradeRows").innerHTML=lessonGradeRows(course.id,key,duration); showToast(absent?`${student.name} wieder als anwesend markiert`:`${student.name}: ${duration} Fehlstunde${duration===1?"":"n"} erfasst`);
}

function timetableEntryLabel(item, index) {
  const course=state.courses.find(candidate=>candidate.id===item.courseId);
  if(!course) return "Unbekannter Kurs";
  const row=Math.floor(index/5); const col=index%5;
  const hours=item.duration===2?`${timetableTimes[row].label}.–${timetableTimes[row+1].label}. Stunde`:`${timetableTimes[row].label}. Stunde`;
  return `${timetableDays[col]} · ${hours} · ${course.name} ${course.subject}`;
}

function timetableSlotRow(slot={},index=0) {
  return `<div class="timetable-slot-row">
    <span class="slot-number">${index+1}</span>
    <label><span>Wochentag</span><select class="slot-day">${timetableDays.map((day,dayIndex)=>`<option value="${dayIndex}" ${dayIndex===(slot.col??0)?"selected":""}>${day}</option>`).join("")}</select></label>
    <label><span>Beginn</span><select class="slot-row">${timetableTimes.map((time,rowIndex)=>`<option value="${rowIndex}" ${rowIndex===(slot.row??0)?"selected":""}>${time.label}. Std. · ${time.time}</option>`).join("")}</select></label>
    <label><span>Dauer</span><select class="slot-duration"><option value="1" ${slot.duration!==2?"selected":""}>Einzelstunde</option><option value="2" ${slot.duration===2?"selected":""}>Doppelstunde</option></select></label>
    <button type="button" class="slot-remove" data-remove-timetable-slot aria-label="Diesen Termin entfernen">×</button>
  </div>`;
}

function renumberTimetableSlots() { qa(".timetable-slot-row").forEach((row,index)=>row.querySelector(".slot-number").textContent=index+1); }
function addTimetableSlot() { q("#timetableSlots").insertAdjacentHTML("beforeend",timetableSlotRow({},qa(".timetable-slot-row").length)); }

function openTimetableEditor(editIndex=null) {
  const editing=editIndex!==null; const existing=editing ? state.timetable[editIndex] : null;
  const row=editing ? Math.floor(editIndex/5) : 0; const col=editing ? editIndex%5 : 0;
  const selectedCourse=state.courses.find(course=>course.id===existing?.courseId) || state.courses[0];
  const entries=state.timetable.map((item,index)=>item?.courseId ? `<button data-edit-timetable-index="${index}"><span>${escapeHtml(timetableEntryLabel(item,index))}</span><small>Bearbeiten</small></button>` : "").join("");
  const dialog=q("#detailDialog");
  dialog.innerHTML=`<div class="dialog-inner"><div class="dialog-head"><div><span class="soft-label">Wochenvorlage</span><h3>${editing?"Unterricht ändern":"Alle Stunden eines Kurses"}</h3></div><button class="close-dialog">×</button></div>
    <div class="form-note">${editing?"Diese Angabe wiederholt sich jede Woche.":"Kurs und Raum nur einmal auswählen, danach alle wöchentlichen Unterrichtszeiten ergänzen."} Planung, Status und Hausaufgaben bleiben bei der einzelnen Stunde.</div>
    <div class="form-grid timetable-form">
      <label class="form-field full"><span>Kurs</span><select id="timetableCourseInput">${state.courses.map(course=>`<option value="${course.id}" ${course.id===selectedCourse.id?"selected":""}>${escapeHtml(course.name)} · ${escapeHtml(course.subject)}</option>`).join("")}</select></label>
      <label class="form-field full"><span>Raum</span><input id="timetableRoomInput" value="${escapeHtml(existing?.room ?? selectedCourse.room ?? "")}" placeholder="optional"></label>
      ${editing?`<label class="form-field"><span>Wochentag</span><select id="timetableDayInput">${timetableDays.map((day,index)=>`<option value="${index}" ${index===col?"selected":""}>${day}</option>`).join("")}</select></label>
      <label class="form-field"><span>Beginn</span><select id="timetableRowInput">${timetableTimes.map((time,index)=>`<option value="${index}" ${index===row?"selected":""}>${time.label}. Stunde · ${time.time}</option>`).join("")}</select></label>
      <label class="form-field"><span>Dauer</span><select id="timetableDurationInput"><option value="1" ${(existing?.duration||1)===1?"selected":""}>Einzelstunde</option><option value="2" ${existing?.duration===2?"selected":""}>Doppelstunde</option></select></label>`:""}
    </div>
    ${editing?"":`<div class="editor-section timetable-slots-section"><div class="editor-heading"><h4>Unterrichtszeiten</h4><span class="soft-label">gemeinsam speichern</span></div><div id="timetableSlots" class="timetable-slots">${timetableSlotRow({},0)}</div><button type="button" class="secondary-button series-add" id="addTimetableSlot">＋ Weitere Unterrichtszeit</button></div>`}
    ${!editing&&entries?`<div class="editor-section"><div class="editor-heading"><h4>Vorhandenen Unterricht ändern</h4><span class="soft-label">${state.timetable.filter(item=>item?.courseId).length} Termine</span></div><div class="timetable-entry-list">${entries}</div></div>`:""}
    <div class="dialog-actions">${editing?`<button class="text-button danger-text" data-delete-timetable-index="${editIndex}">Unterricht entfernen</button>`:""}<button class="secondary-button close-dialog">Abbrechen</button><button class="primary-button" id="saveTimetableEntry" data-edit-index="${editing?editIndex:""}">Speichern</button></div></div>`;
  if(!dialog.open) dialog.showModal();
}

function saveTimetableEntry(button) {
  const oldIndex=button.dataset.editIndex==="" ? null : Number(button.dataset.editIndex);
  if(oldIndex===null) {
    const course=state.courses.find(candidate=>candidate.id===q("#timetableCourseInput").value); const room=q("#timetableRoomInput").value.trim();
    const slots=qa(".timetable-slot-row").map(slot=>({row:Number(q(".slot-row",slot).value),col:Number(q(".slot-day",slot).value),duration:Number(q(".slot-duration",slot).value)}));
    if(!slots.length) { showToast("Bitte mindestens eine Unterrichtszeit eintragen"); return; }
    const occupied=new Set();
    for(const slot of slots) {
      if(slot.duration===2&&slot.row===timetableTimes.length-1) { showToast("Eine Doppelstunde kann nicht in der 8. Stunde beginnen"); return; }
      const indices=[slot.row*5+slot.col,...(slot.duration===2?[(slot.row+1)*5+slot.col]:[])];
      if(indices.some(index=>occupied.has(index))) { showToast("Zwei neue Termine überschneiden sich"); return; }
      if(indices.some(index=>state.timetable[index])) { showToast(`${timetableDays[slot.col]}, ${slot.row+1}. Stunde ist bereits belegt`); return; }
      indices.forEach(index=>occupied.add(index));
    }
    slots.forEach(slot=>{ const index=slot.row*5+slot.col; state.timetable[index]={courseId:course.id,room,duration:slot.duration}; if(slot.duration===2) state.timetable[index+5]={continuesFrom:index}; });
    saveState(); q("#detailDialog").close(); renderTimetable(); renderToday(); showToast(`${slots.length} Unterrichtstermin${slots.length===1?"":"e"} eingetragen`); return;
  }
  const row=Number(q("#timetableRowInput").value); const col=Number(q("#timetableDayInput").value); const duration=Number(q("#timetableDurationInput").value); const newIndex=row*5+col;
  if(duration===2 && row===timetableTimes.length-1) { showToast("Eine Doppelstunde kann nicht in der 8. Stunde beginnen"); return; }
  const oldOccupied=oldIndex===null?[]:[oldIndex,...(state.timetable[oldIndex]?.duration===2?[oldIndex+5]:[])]; const newOccupied=[newIndex,...(duration===2?[newIndex+5]:[])];
  if(newOccupied.some(index=>state.timetable[index] && !oldOccupied.includes(index))) { showToast("Mindestens eine dieser Stunden ist bereits belegt"); return; }
  const course=state.courses.find(candidate=>candidate.id===q("#timetableCourseInput").value);
  oldOccupied.forEach(index=>state.timetable[index]=null);
  state.timetable[newIndex]={courseId:course.id,room:q("#timetableRoomInput").value.trim(),duration};
  if(duration===2) state.timetable[newIndex+5]={continuesFrom:newIndex};
  saveState(); q("#detailDialog").close(); renderTimetable(); renderToday(); showToast("Unterricht geändert");
}

function deleteTimetableEntry(index) {
  const duration=state.timetable[index]?.duration||1; state.timetable[index]=null; if(duration===2) state.timetable[index+5]=null; saveState(); q("#detailDialog").close(); renderTimetable(); showToast("Unterricht aus dem Stundenplan entfernt");
}

function scheduleChangeGroup(key) {
  const change=state.scheduleChanges[key]; if(!change) return null;
  const keys=change.batchId?Object.keys(state.scheduleChanges).filter(candidate=>state.scheduleChanges[candidate].batchId===change.batchId):[key];
  return {key:keys.sort()[0],keys,change};
}

function scheduleChangeGroups() {
  const seen=new Set(); const groups=[];
  Object.keys(state.scheduleChanges).sort().forEach(key=>{ const group=scheduleChangeGroup(key); if(!group || seen.has(group.key)) return; seen.add(group.key); groups.push(group); });
  return groups;
}

function scheduleChangeLabel(change,key) {
  const [date,rowText]=key.split("|"); const row=Number(rowText); const from=change.rangeFrom??row; const to=change.rangeTo??row; const day=new Intl.DateTimeFormat("de-DE",{weekday:"short",day:"2-digit",month:"2-digit"}).format(new Date(`${date}T12:00:00`));
  const kind=change.kind==="cancel"?"Ausfall":change.kind==="room"?`Raum ${change.room}`:"Vertretung / zusätzlich";
  const hours=from===to?`${timetableTimes[from]?.label}. Stunde`:`${timetableTimes[from]?.label}.–${timetableTimes[to]?.label}. Stunde`;
  return `${day} · ${hours} · ${kind}`;
}

function restoreChangeLessonStatus(key,change) {
  if(!change?.originalCourseId || change.previousStatus===undefined) return;
  const [date,rowText]=key.split("|"); const planKey=lessonKey(new Date(`${date}T12:00:00`),change.originalCourseId,Number(rowText)); const plan=state.lessonPlans[planKey];
  if(!plan?.scheduleChange) return;
  if(change.previousStatus) plan.status=change.previousStatus; else delete plan.status;
  delete plan.scheduleChange;
  if(!Object.keys(plan).length) delete state.lessonPlans[planKey];
}

function openScheduleChangeDialog(editKey=null) {
  const firstLessonIndex=state.timetable.findIndex(item=>item?.courseId); const firstLessonRow=Math.floor(firstLessonIndex/5); const firstLessonDate=dateKey(addDays(displayedMonday(),firstLessonIndex%5));
  const existingGroup=editKey?scheduleChangeGroup(editKey):null; const existing=existingGroup?.change; const [savedDate,savedRow]=editKey?existingGroup.key.split("|"):[firstLessonDate,String(firstLessonRow)]; const row=Number(savedRow); const rowTo=existing?.rangeTo??row; const rowFrom=existing?.rangeFrom??row; const base=baseScheduleAt(savedDate,rowFrom); const selectedCourseId=existing?.courseId||base.item?.courseId||state.courses.find(course=>!course.organizationOnly)?.id||state.courses[0].id;
  const entries=scheduleChangeGroups().map(group=>`<button data-edit-schedule-change="${group.key}"><span>${escapeHtml(scheduleChangeLabel(group.change,group.key))}</span><small>Bearbeiten</small></button>`).join("");
  const dialog=q("#detailDialog");
  dialog.innerHTML=`<div class="dialog-inner"><div class="dialog-head"><div><span class="soft-label">Einmalige Abweichung</span><h3>${existing?"Änderung bearbeiten":"Änderung eintragen"}</h3></div><button class="close-dialog">×</button></div>
    <div class="form-note" id="scheduleChangeContext"></div>
    <div class="form-grid timetable-form">
      <label class="form-field"><span>Datum</span><input type="date" id="scheduleChangeDate" value="${savedDate}"></label>
      <label class="form-field"><span>Von Stunde</span><select id="scheduleChangeRowFrom">${timetableTimes.map((time,index)=>`<option value="${index}" ${index===rowFrom?"selected":""}>${time.label}. Stunde · ${time.time}</option>`).join("")}</select></label>
      <label class="form-field"><span>Bis Stunde</span><select id="scheduleChangeRowTo">${timetableTimes.map((time,index)=>`<option value="${index}" ${index===rowTo?"selected":""}>${time.label}. Stunde</option>`).join("")}</select></label>
      <label class="form-field full"><span>Art der Änderung</span><select id="scheduleChangeType"><option value="cancel" ${existing?.kind==="cancel"?"selected":""}>Unterricht fällt aus</option><option value="room" ${existing?.kind==="room"?"selected":""}>Einmaliger Raumwechsel</option><option value="replacement" ${existing?.kind==="replacement"?"selected":""}>Vertretung / zusätzlicher Unterricht</option></select></label>
      <label class="form-field full change-course-field"><span>Kurs</span><select id="scheduleChangeCourse">${state.courses.map(course=>`<option value="${course.id}" ${course.id===selectedCourseId?"selected":""}>${escapeHtml(course.name)} · ${escapeHtml(course.subject)}</option>`).join("")}</select></label>
      <label class="form-field full change-room-field"><span>Raum</span><input id="scheduleChangeRoom" value="${escapeHtml(existing?.room ?? base.item?.room ?? "")}" placeholder="z. B. R 2"></label>
    </div>
    ${!existing&&entries?`<div class="editor-section"><div class="editor-heading"><h4>Gespeicherte Änderungen</h4><span class="soft-label">${scheduleChangeGroups().length}</span></div><div class="timetable-entry-list">${entries}</div></div>`:""}
    <div class="dialog-actions">${existing?`<button class="text-button danger-text" data-delete-schedule-change="${editKey}">Änderung entfernen</button>`:""}<button class="secondary-button close-dialog">Abbrechen</button><button class="primary-button" id="saveScheduleChange" data-edit-change="${editKey||""}">Speichern</button></div></div>`;
  syncScheduleChangeDialog(); if(!dialog.open) dialog.showModal();
}

function syncScheduleChangeDialog() {
  const date=q("#scheduleChangeDate")?.value; const from=Number(q("#scheduleChangeRowFrom")?.value); const to=Number(q("#scheduleChangeRowTo")?.value); const kind=q("#scheduleChangeType")?.value;
  if(!date || Number.isNaN(from) || Number.isNaN(to)) return;
  if(to<from) q("#scheduleChangeRowTo").value=String(from);
  const finalTo=Math.max(from,to); const lessons=[];
  for(let row=from;row<=finalTo;row++) { const base=baseScheduleAt(date,row); const course=state.courses.find(candidate=>candidate.id===base.item?.courseId); if(course && !lessons.includes(`${course.name} · ${course.subject}`)) lessons.push(`${course.name} · ${course.subject}`); }
  const context=q("#scheduleChangeContext"); context.textContent=lessons.length?`Regulär betroffen: ${lessons.join(", ")}`:"Der ausgewählte Zeitraum ist regulär frei.";
  q(".change-course-field")?.classList.toggle("hidden",kind!=="replacement");
  q(".change-room-field")?.classList.toggle("hidden",kind==="cancel");
  const firstBase=baseScheduleAt(date,from); const firstCourse=state.courses.find(candidate=>candidate.id===firstBase.item?.courseId);
  if(kind==="room" && firstBase.item && !q("#scheduleChangeRoom").value) q("#scheduleChangeRoom").value=firstBase.item.room||firstCourse?.room||"";
}

function saveScheduleChange(button) {
  const date=q("#scheduleChangeDate").value; const from=Number(q("#scheduleChangeRowFrom").value); const to=Number(q("#scheduleChangeRowTo").value); const kind=q("#scheduleChangeType").value; const editKey=button.dataset.editChange; const editGroup=editKey?scheduleChangeGroup(editKey):null; const editKeys=new Set(editGroup?.keys||[]);
  if(to<from) { showToast("Die Bis-Stunde muss nach der Von-Stunde liegen"); return; }
  const room=q("#scheduleChangeRoom").value.trim(); if(kind==="room" && !room) { showToast("Bitte den neuen Raum eintragen"); return; }
  const targets=new Map();
  for(let selectedRow=from;selectedRow<=to;selectedRow++) { const base=baseScheduleAt(date,selectedRow); if((kind==="cancel" || kind==="room") && !base.item) continue; const row=base.item?base.row:selectedRow; targets.set(scheduleChangeKey(date,row),{row,base}); }
  if(!targets.size) { showToast("Im ausgewählten Zeitraum liegt kein Unterricht"); return; }
  if([...targets.keys()].some(key=>state.scheduleChanges[key] && !editKeys.has(key))) { showToast("Für mindestens eine dieser Stunden besteht bereits eine Änderung"); return; }
  editGroup?.keys.forEach(key=>{ restoreChangeLessonStatus(key,state.scheduleChanges[key]); delete state.scheduleChanges[key]; });
  const batchId=targets.size>1?`change-${Date.now()}`:"";
  targets.forEach(({row,base},key)=>{
    const change={kind,room,rangeFrom:from,rangeTo:to,batchId}; if(kind==="replacement") change.courseId=q("#scheduleChangeCourse").value;
    if((kind==="cancel" || kind==="replacement") && base.item?.courseId) { change.originalCourseId=base.item.courseId; const planKey=lessonKey(new Date(`${date}T12:00:00`),base.item.courseId,row); const plan=state.lessonPlans[planKey]||(state.lessonPlans[planKey]={courseId:base.item.courseId}); change.previousStatus=plan.status||""; plan.status="canceled"; plan.scheduleChange=true; }
    state.scheduleChanges[key]=change;
  });
  saveState(); q("#detailDialog").close(); renderTimetable(); showToast(`${targets.size} Änderung${targets.size>1?"en":""} im Stundenplan gespeichert`);
}

function deleteScheduleChange(key) {
  const group=scheduleChangeGroup(key); group?.keys.forEach(changeKey=>{ restoreChangeLessonStatus(changeKey,state.scheduleChanges[changeKey]); delete state.scheduleChanges[changeKey]; }); saveState(); q("#detailDialog").close(); renderTimetable(); showToast("Änderung entfernt");
}

function openMore(studentId) {
  const student = currentStudents().find(s=>s.id===studentId);
  const dialog = q("#detailDialog");
  dialog.innerHTML = `<div class="dialog-inner"><div class="dialog-head"><div><span class="soft-label">Optional</span><h3>${student.name}</h3></div><button class="close-dialog">×</button></div><div class="menu-list"><button data-optional="Hausaufgabe">□ Vergessene Hausaufgabe vermerken</button><button data-optional="Kommentar">✎ Kurzen Kommentar hinzufügen</button><button data-show-history="${student.id}">↗ Notenverlauf und Endnote öffnen</button></div></div>`;
  dialog.showModal();
}

function openEditGradeDialog(studentId,gradeId) {
  const student=currentStudents().find(candidate=>candidate.id===studentId); const grade=student?.grades.find(candidate=>candidate.id===gradeId); if(!grade) return;
  const dialog=q("#detailDialog"); dialog.innerHTML=`<div class="dialog-inner"><div class="dialog-head"><div><span class="soft-label">${escapeHtml(student.name)} · ${state.quarter}</span><h3>Note bearbeiten</h3></div><button class="close-dialog">×</button></div><div class="form-grid"><label class="form-field"><span>Note</span><select id="editGradeValue">${[1,2,3,4,5,6].map(value=>`<option ${value===grade.v?"selected":""}>${value}</option>`).join("")}</select></label><label class="form-field"><span>Bereich</span><select id="editGradeCategory"><option value="oral" ${grade.c==="oral"?"selected":""}>Mündlich</option><option value="other" ${grade.c==="other"?"selected":""}>Sonstige</option><option value="written" ${grade.c==="written"?"selected":""}>Schriftlich</option></select></label><label class="form-field"><span>Gewichtung</span><select id="editGradeWeight"><option value="1" ${grade.w!==2?"selected":""}>1×</option><option value="2" ${grade.w===2?"selected":""}>2× · Doppelstunde</option></select></label></div><div class="dialog-actions"><button class="text-button danger-text" id="deleteGrade" data-student-id="${studentId}" data-grade-id="${gradeId}">Note löschen</button><button class="secondary-button close-dialog">Abbrechen</button><button class="primary-button" id="saveGradeEdit" data-student-id="${studentId}" data-grade-id="${gradeId}">Speichern</button></div></div>`; dialog.showModal();
}

function saveGradeEdit(button) {
  const student=currentStudents().find(candidate=>candidate.id===Number(button.dataset.studentId)); const grade=student?.grades.find(candidate=>candidate.id===button.dataset.gradeId); if(!grade) return;
  grade.v=Number(q("#editGradeValue").value); grade.c=q("#editGradeCategory").value; grade.w=Number(q("#editGradeWeight").value); saveState(); q("#detailDialog").close(); renderStudents(); renderToday(); showToast("Note geändert");
}

function deleteGrade(button) {
  if(button.dataset.confirmDelete!=="true") { button.dataset.confirmDelete="true"; button.textContent="Wirklich löschen?"; return; }
  const student=currentStudents().find(candidate=>candidate.id===Number(button.dataset.studentId)); student.grades=student.grades.filter(grade=>grade.id!==button.dataset.gradeId); saveState(); q("#detailDialog").close(); renderStudents(); renderToday(); showToast("Note gelöscht");
}

function deleteAttendance(button) {
  if(button.dataset.confirmDelete!=="true") { button.dataset.confirmDelete="true"; button.textContent="Wirklich aufheben?"; return; }
  const entry=state.attendance[button.dataset.deleteAttendance]; const student=currentStudents().find(candidate=>candidate.id===Number(button.dataset.studentId)); if(entry&&student) student.absences=Math.max(0,student.absences-entry.hours); delete state.attendance[button.dataset.deleteAttendance]; saveState(); renderStudents(); showToast("Abwesenheit aufgehoben");
}

function openAbsenceDialog() {
  const dialog = q("#absenceDialog");
  dialog.innerHTML = `<div class="dialog-inner"><div class="dialog-head"><div><span class="soft-label">Oberstufe · ${state.quarter}</span><h3>Fehlstunden abgleichen</h3><p>Trage nur die gemeldete Anzahl entschuldigter Stunden ein.</p></div><button class="close-dialog">×</button></div><div class="dialog-body">${currentStudents().map(s=>{
    const excused = Number(state.excused[`${state.courseId}-${s.id}`]||0); const unexcused = Math.max(0,s.absences-excused);
    return `<div class="dialog-row"><div><b>${s.name}</b><small>${s.absences} Fehlstunden insgesamt</small></div><input class="number-input" type="number" min="0" max="${s.absences}" value="${excused}" data-excused="${s.id}" aria-label="Entschuldigte Fehlstunden für ${s.name}"><span class="result-badge">${unexcused} × Note 6</span></div>`;
  }).join("")}</div><div class="dialog-actions"><button class="secondary-button close-dialog">Abbrechen</button><button class="primary-button" id="saveAbsences">Abgleich übernehmen</button></div></div>`;
  dialog.showModal();
}

function closeDialog(target) { target.closest("dialog")?.close(); }

function initEvents() {
  document.addEventListener("click", event => {
    const viewButton = event.target.closest("[data-view]");
    if(viewButton) switchView(viewButton.dataset.view);
    if(event.target.closest("#notificationButton")) { openNotificationsDialog(); return; }
    if(event.target.closest("#profileButton")) { openSettingsDialog(); return; }
    if(event.target.closest("#saveSettings")) { saveSettings(); return; }
    if(event.target.closest("#lockNow")) { q("#detailDialog").close(); showPrivacyLock(); return; }
    if(event.target.closest("#unlockApp")) { unlockApp(); return; }
    if(event.target.closest("#closeQuarter")) { openPeriodCloseDialog("quarter"); return; }
    if(event.target.closest("#closeSchoolYear")) { openPeriodCloseDialog("year"); return; }
    const periodClose=event.target.closest("#confirmPeriodClose"); if(periodClose) { completePeriod(periodClose.dataset.periodType); return; }
    const archiveButton=event.target.closest("[data-view-archive]"); if(archiveButton) { openArchive(archiveButton.dataset.viewArchive); return; }
    if(event.target.closest("#exportBackup")) { exportBackup(); return; }
    if(event.target.closest("#importBackup")) { importBackup(); return; }
    const targetButton = event.target.closest("[data-view-target]");
    if(targetButton) switchView(targetButton.dataset.viewTarget);
    const manageCourse = event.target.closest("[data-manage-course]");
    if(manageCourse) { openManageCourse(manageCourse.dataset.manageCourse); return; }
    const courseButton = event.target.closest("[data-open-course]");
    if(courseButton) { state.courseId = courseButton.dataset.openCourse; saveState(); renderCourses(); switchView("grades"); renderStudents(); return; }
    if(event.target.closest("#addCourse")) { openCreateCourse(); return; }
    if(event.target.closest("#createCourseSave")) { createCourseFromDialog(); return; }
    const openSeriesCourseButton=event.target.closest("[data-open-series-course]");
    if(openSeriesCourseButton) { openSeriesDialog(openSeriesCourseButton.dataset.openSeriesCourse); return; }
    if(event.target.closest("#addSeriesUnit")) { addSeriesUnitRow(); return; }
    const saveSeriesButton=event.target.closest("#saveSeries");
    if(saveSeriesButton) { saveSeries(saveSeriesButton.dataset.courseId); return; }
    const statusButton=event.target.closest("#lessonStatusControl [data-status]");
    if(statusButton) { q("#detailDialog").dataset.lessonStatus=statusButton.dataset.status; qa("#lessonStatusControl button").forEach(button=>button.classList.toggle("active",button===statusButton)); return; }
    const saveLessonButton=event.target.closest("#saveLessonPlan");
    if(saveLessonButton) { saveLessonPlan(saveLessonButton); return; }
    const openLessonGradesButton=event.target.closest("[data-open-lesson-grades]");
    if(openLessonGradesButton) {
      const planButton=q("#saveLessonPlan"); if(planButton) saveLessonPlan(planButton,{close:false,notify:false});
      openLessonGradeDialog({courseId:openLessonGradesButton.dataset.courseId,lessonKeyValue:openLessonGradesButton.dataset.lessonKey,date:openLessonGradesButton.dataset.date,duration:Number(openLessonGradesButton.dataset.duration)}); return;
    }
    const lessonGradeCategoryButton=event.target.closest("[data-lesson-grade-category]");
    if(lessonGradeCategoryButton) { q("#detailDialog").dataset.gradeCategory=lessonGradeCategoryButton.dataset.lessonGradeCategory; qa("#timetableGradeCategory button").forEach(button=>button.classList.toggle("active",button===lessonGradeCategoryButton)); return; }
    const lessonGradeButton=event.target.closest("[data-lesson-grade]");
    if(lessonGradeButton) { addLessonGrade(Number(lessonGradeButton.dataset.lessonGrade),Number(lessonGradeButton.dataset.studentId)); return; }
    const lessonAbsentButton=event.target.closest("[data-lesson-absent]");
    if(lessonAbsentButton) { toggleLessonAbsence(Number(lessonAbsentButton.dataset.lessonAbsent)); return; }
    if(event.target.closest("#addException")) { openScheduleChangeDialog(); return; }
    const editScheduleChangeButton=event.target.closest("[data-edit-schedule-change]");
    if(editScheduleChangeButton) { openScheduleChangeDialog(editScheduleChangeButton.dataset.editScheduleChange); return; }
    const saveScheduleChangeButton=event.target.closest("#saveScheduleChange");
    if(saveScheduleChangeButton) { saveScheduleChange(saveScheduleChangeButton); return; }
    const deleteScheduleChangeButton=event.target.closest("[data-delete-schedule-change]");
    if(deleteScheduleChangeButton) {
      if(deleteScheduleChangeButton.dataset.confirmDelete!=="true") { deleteScheduleChangeButton.dataset.confirmDelete="true"; deleteScheduleChangeButton.textContent="Wirklich entfernen?"; return; }
      deleteScheduleChange(deleteScheduleChangeButton.dataset.deleteScheduleChange); return;
    }
    if(event.target.closest("#addLesson")) { openTimetableEditor(); return; }
    if(event.target.closest("#addTimetableSlot")) { addTimetableSlot(); return; }
    const removeTimetableSlot=event.target.closest("[data-remove-timetable-slot]");
    if(removeTimetableSlot) { if(qa(".timetable-slot-row").length===1) { showToast("Mindestens eine Unterrichtszeit bleibt erforderlich"); return; } removeTimetableSlot.closest(".timetable-slot-row").remove(); renumberTimetableSlots(); return; }
    const editTimetableButton=event.target.closest("[data-edit-timetable-index]");
    if(editTimetableButton) { openTimetableEditor(Number(editTimetableButton.dataset.editTimetableIndex)); return; }
    const saveTimetableButton=event.target.closest("#saveTimetableEntry");
    if(saveTimetableButton) { saveTimetableEntry(saveTimetableButton); return; }
    const deleteTimetableButton=event.target.closest("[data-delete-timetable-index]");
    if(deleteTimetableButton) {
      if(deleteTimetableButton.dataset.confirmDelete!=="true") { deleteTimetableButton.dataset.confirmDelete="true"; deleteTimetableButton.textContent="Wirklich entfernen?"; return; }
      deleteTimetableEntry(Number(deleteTimetableButton.dataset.deleteTimetableIndex)); return;
    }
    const saveCourseButton = event.target.closest("#saveCourseChanges");
    if(saveCourseButton) { saveCourseChanges(saveCourseButton.dataset.courseId); return; }
    const editGradeButton=event.target.closest("[data-edit-grade]"); if(editGradeButton) { openEditGradeDialog(Number(editGradeButton.dataset.studentId),editGradeButton.dataset.editGrade); return; }
    const saveGradeButton=event.target.closest("#saveGradeEdit"); if(saveGradeButton) { saveGradeEdit(saveGradeButton); return; }
    const deleteGradeButton=event.target.closest("#deleteGrade"); if(deleteGradeButton) { deleteGrade(deleteGradeButton); return; }
    const deleteAttendanceButton=event.target.closest("[data-delete-attendance]"); if(deleteAttendanceButton) { deleteAttendance(deleteAttendanceButton); return; }
    const gradeButton = event.target.closest("[data-add-grade]");
    if(gradeButton) {
      const student = currentStudents().find(s=>s.id===Number(gradeButton.dataset.studentId));
      const category = activeEntryArea === "written" ? "written" : activeCategory;
      const weight = activeEntryArea === "written" ? 1 : activeWeight;
      student.grades.push({id:newGradeId(),v:Number(gradeButton.dataset.addGrade),c:category,w:weight,type:activeEntryArea === "written" ? activeWrittenType : undefined,quarter:state.quarter,schoolYear:state.settings.schoolYear,date:dateKey(today)}); saveState(); renderStudents(); renderToday();
      const context = activeEntryArea === "written" ? activeWrittenType : `${labelCategory(category)} · ${weight}×`;
      showToast(`Note ${gradeButton.dataset.addGrade} (${context}) für ${student.name} gespeichert`);
    }
    const absent = event.target.closest("[data-absent]");
    if(absent) { const student=currentStudents().find(s=>s.id===Number(absent.dataset.absent)); student.absences += activeWeight; const key=`manual|${Date.now()}|${student.id}`; state.attendance[key]={hours:activeWeight,courseId:state.courseId,studentId:student.id,date:dateKey(today),quarter:state.quarter,schoolYear:state.settings.schoolYear}; saveState(); renderStudents(); showToast(`${activeWeight} Fehlstunde${activeWeight>1?"n":""} für ${student.name} erfasst`); }
    const more = event.target.closest("[data-more]"); if(more) openMore(Number(more.dataset.more));
    const close = event.target.closest(".close-dialog"); if(close) closeDialog(close);
    const optional = event.target.closest("[data-optional]"); if(optional) { showToast(`${optional.dataset.optional}: Funktion im nächsten Ausbauschritt`); closeDialog(optional); }
    const history = event.target.closest("[data-show-history]"); if(history) { expandedStudent=Number(history.dataset.showHistory); closeDialog(history); renderStudents(); }
    const lesson = event.target.closest("[data-lesson-key]"); if(lesson) openLessonDialog(lesson);
  });

  q("#detailDialog").addEventListener("change", e => {
    if(e.target.id === "organizationInput") refreshNewCourseFields();
    if(e.target.id === "timetableCourseInput") { const course=state.courses.find(candidate=>candidate.id===e.target.value); q("#timetableRoomInput").value=course?.room||""; }
    if(["scheduleChangeDate","scheduleChangeRowFrom","scheduleChangeRowTo","scheduleChangeType"].includes(e.target.id)) syncScheduleChangeDialog();
    if(e.target.id==="scheduleChangeCourse" && q("#scheduleChangeType")?.value==="replacement") { const course=state.courses.find(candidate=>candidate.id===e.target.value); q("#scheduleChangeRoom").value=course?.room||""; }
    if(e.target.id==="importBackupFile" && e.target.files[0]) prepareBackup(e.target.files[0]);
    if(e.target.id==="studentImportFile" && e.target.files[0]) prepareStudentImport(e.target.files[0]);
  });

  q("#unlockPin").addEventListener("keydown",event=>{ if(event.key==="Enter") unlockApp(); });

  q("#entryAreaControl").addEventListener("click", e => { if(!e.target.dataset.area)return; activeEntryArea=e.target.dataset.area; qa("button",e.currentTarget).forEach(b=>b.classList.toggle("active",b===e.target)); syncEntryControls(); renderStudents(); });
  q("#lessonCategoryControl").addEventListener("click", e => { if(!e.target.dataset.category)return; activeCategory=e.target.dataset.category; qa("button",e.currentTarget).forEach(b=>b.classList.toggle("active",b===e.target)); });
  q("#weightControl").addEventListener("click", e => { if(!e.target.dataset.weight)return; activeWeight=Number(e.target.dataset.weight); qa("button",e.currentTarget).forEach(b=>b.classList.toggle("active",b===e.target)); q("#lessonWeightLabel").textContent=activeWeight===2?"Doppelstunde · 2×":"Einzelstunde · 1×"; });
  q("#writtenTypeControl").addEventListener("click", e => { if(!e.target.dataset.writtenType)return; activeWrittenType=e.target.dataset.writtenType; qa("button",e.currentTarget).forEach(b=>b.classList.toggle("active",b===e.target)); syncEntryControls(); });
  q("#togglePrevious").addEventListener("click", e => { const visible=e.currentTarget.dataset.visible!=="true"; e.currentTarget.dataset.visible=String(visible); e.currentTarget.textContent=visible?"Vorherige Note ausblenden":"Vorherige Note einblenden"; renderStudents(); });
  q("#studentRows").addEventListener("change", e => { if(!e.target.dataset.finalStudent)return; const key=`${state.settings.schoolYear}-${state.courseId}-${state.quarter}-${e.target.dataset.finalStudent}`; if(e.target.value) state.finalOverrides[key]=Number(e.target.value); else delete state.finalOverrides[key];saveState();renderStudents();showToast("Pädagogische Endnote übernommen"); });
  q("#courseSelect").addEventListener("change", e => { state.courseId=e.target.value;saveState();renderStudents(); });
  q("#quarterSelect").addEventListener("change", e => { state.quarter=e.target.value;saveState();renderStudents(); });
  q("#openAbsences").addEventListener("click",openAbsenceDialog);
  q("#absenceDialog").addEventListener("input", e => { if(!e.target.dataset.excused)return; const total=currentStudents().find(s=>s.id===Number(e.target.dataset.excused)).absences; const value=Math.min(total,Math.max(0,Number(e.target.value))); e.target.closest(".dialog-row").querySelector(".result-badge").textContent=`${total-value} × Note 6`; });
  q("#absenceDialog").addEventListener("click", e => { if(e.target.id!=="saveAbsences")return; qa("[data-excused]",e.currentTarget).forEach(input=>state.excused[`${state.courseId}-${input.dataset.excused}`]=Number(input.value));saveState();e.currentTarget.close();renderStudents();showToast("Fehlstundenabgleich gespeichert"); });
  q("#resetDemo").addEventListener("click",()=>{ state=defaultState();saveState();renderAll();showToast("Testdaten zurückgesetzt"); });
  q("#syncButton").addEventListener("click",()=>showToast("Namen, Noten und Plan bleiben ausschließlich in diesem Browser"));
  q("#openSeries").addEventListener("click",()=>openSeriesDialog());
  q("#previousWeek").addEventListener("click",()=>{state.weekOffset--;saveState();renderTimetable();});
  q("#nextWeek").addEventListener("click",()=>{state.weekOffset++;saveState();renderTimetable();});
  q("#currentWeek").addEventListener("click",()=>{state.weekOffset=0;saveState();renderTimetable();});
  ["addTask","editHoliday"].forEach(id=>q(`#${id}`)?.addEventListener("click",()=>showToast("Diese Funktion folgt im nächsten Ausbauschritt")));
  qa(".task-row input").forEach((input,i)=>{ input.checked=state.tasksDone.includes(i); input.addEventListener("change",()=>{ state.tasksDone=qa(".task-row input").map((x,n)=>x.checked?n:null).filter(x=>x!==null);saveState(); }); });
}

function renderAll() {
  const date = new Intl.DateTimeFormat("de-DE",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(today);
  q("#dateLabel").textContent = date;
  q("#quarterSelect").value=state.quarter;
  renderCourses(); renderTimetable(); syncEntryControls(); renderStudents(); renderTopbar(); renderToday();
}

renderAll();
initEvents();

let appHiddenAt=null;
document.addEventListener("visibilitychange",()=>{
  if(document.hidden) appHiddenAt=Date.now();
  else if(state.settings.lockHash&&appHiddenAt&&Date.now()-appHiddenAt>=Number(state.settings.lockMinutes||5)*60000) showPrivacyLock();
});
if(state.settings.lockHash) showPrivacyLock();

if("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"}).then(registration=>registration.update()).catch(()=>{});
