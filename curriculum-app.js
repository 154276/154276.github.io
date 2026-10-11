import {SUBJECTS,UNITS,QUESTIONS,TOTAL,SCHOOL_UNITS} from "./curriculum-data.js";

// 学びの星の既存セーブデータと共通。既存の記録や装飾は変更しない。
const SAVE_KEY="manabi-world-v1";
const $=id=>document.getElementById(id);
const views=["catalog","unitsView","quizView","resultView"];
const qById=new Map(QUESTIONS.map(q=>[q.id,q]));
const unitById=new Map(UNITS.map(u=>[u.id,u]));
const subjectById=new Map(SUBJECTS.map(s=>[s.id,s]));
let selectedSubject=null,selectedUnit=null,session=null;

function storage(){
 try{
  const g=JSON.parse(localStorage.getItem(SAVE_KEY)||"null");
  if(!g||g.version!==2||!g.pets||typeof g.pets!=="object"||
    !g.records||typeof g.records!=="object"||!Number.isFinite(g.xp)||
    !Number.isFinite(g.coins)||!Number.isFinite(g.missions)||!Number.isFinite(g.eggs))return null;
  return g;
 }catch{return null}
}
function save(g){
 try{localStorage.setItem(SAVE_KEY,JSON.stringify(g));return true}
 catch{warn("保存できませんでした。ブラウザの保存設定を確認してください。");return false}
}
function warn(message){
 const el=$("alert");el.textContent=message;el.hidden=false;
}
function clearWarn(){$("alert").hidden=true}
function view(id){
 views.forEach(v=>$(v).hidden=v!==id);
 window.scrollTo({top:0,behavior:"instant"});
}
function getRecord(q){
 const g=storage();
 return g?.records?.[q.id]||null;
}
function stats(){
 const g=storage();
 const records=g?.records||{};
 const learned=QUESTIONS.filter(q=>(records[q.id]?.correct||0)>0).length;
 const level=g?Math.min(100,Math.floor(Math.sqrt(Math.max(0,g.xp)/25))+1):1;
 $("level").textContent="⭐ Lv."+level;
 $("coins").textContent="🪙 "+(g?.coins??0);
 $("unitCount").textContent="📘 "+UNITS.length+"単元（授業関連 "+SCHOOL_UNITS+"）";
 $("questionCount").textContent="🧩 "+TOTAL+"問";
 $("clearCount").textContent="🏅 "+learned+"問 正解済み";
}
function percent(arr){
 const g=storage(),records=g?.records||{};
 return arr.length?Math.round(100*arr.filter(q=>(records[q.id]?.correct||0)>0).length/arr.length):0;
}
function button(cls,text,click){
 const el=document.createElement("button");
 el.className=cls;el.type="button";el.textContent=text;el.addEventListener("click",click);
 return el;
}
function div(cls){const el=document.createElement("div");el.className=cls;return el}
function txt(tag,cls,value){const el=document.createElement(tag);el.className=cls;el.textContent=value;return el}
function meter(p){
 const outer=div("meter"),inner=document.createElement("span");
 inner.style.width=p+"%";outer.append(inner);return outer;
}
function renderSubjects(){
 stats();const wrap=$("subjectGrid");wrap.replaceChildren();
 for(const s of SUBJECTS){
  const units=UNITS.filter(x=>x.subject===s.id);
  const qs=units.flatMap(x=>x.questions),p=percent(qs);
  const card=button("subject-card","",()=>selectSubject(s.id));
  card.style.setProperty("--accent",s.color);
  card.style.setProperty("--soft",s.color+"1a");
  card.append(txt("span","subject-icon",s.icon),txt("strong","",s.name),txt("small","",s.summary),meter(p));
  const line=div("statsline");
  line.append(txt("span","",units.length+"単元 / "+qs.length+"問"),txt("span","",p+"% クリア"));
  card.append(line);wrap.append(card);
 }
}
function selectSubject(id){
 selectedSubject=id;selectedUnit=null;renderUnits();view("unitsView");
}
function renderUnits(){
 stats();const s=subjectById.get(selectedSubject);if(!s)return;
 const heading=$("subjectHeading");heading.replaceChildren();
 heading.style.setProperty("--soft",s.color+"24");
 heading.append(txt("span","subject-icon",s.icon));
 const copy=div("");
 copy.append(txt("h2","",s.name+"の学習"),txt("p","",s.summary+"　|　単元を選んで5問に挑戦"));
 heading.append(copy);
 const wrap=$("unitGrid");wrap.replaceChildren();
 for(const u of UNITS.filter(x=>x.subject===s.id)){
  const p=percent(u.questions),card=button("unit-card","",()=>start(s.id,u.id));
  card.append(txt("strong","",u.name),txt("span","small",u.focus));
  if(u.school)card.append(txt("span","badge","★ 授業で学んだ内容に関連"));
  card.append(meter(p));
  const bottom=div("unitbottom");
  bottom.append(txt("span","",u.questions.length+"問収録"),txt("span","",p+"% クリア　→"));
  card.append(bottom);wrap.append(card);
 }
}
function shuffle(items){
 const a=[...items];for(let i=a.length-1;i>0;i--){
  const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];
 }
 return a;
}
function orderQuestions(items){
 const g=storage(),records=g?.records||{},now=Date.now();
 return shuffle(items).sort((a,b)=>{
  const score=q=>{
   const r=records[q.id];if(!r)return 0;
   if((r.failures||0)>0 && (r.mastery||0)<2)return 1;
   if(now-(r.lastAt||0)>=86400000)return 2;
   return 3+(r.mastery||0);
  };
  return score(a)-score(b);
 });
}
function choose(subject,unit){
 let pool,extra=[];
 if(unit){
  const u=unitById.get(unit);pool=u?.questions||[];
  extra=QUESTIONS.filter(q=>q.subject===subject&&q.unit!==unit);
 }else if(subject){
  pool=QUESTIONS.filter(q=>q.subject===subject);
 }else{
  // 全教科おまかせは、同じ教科ばかりにならないよう教科を分散する。
  const chosen=shuffle(SUBJECTS).slice(0,5);
  pool=chosen.flatMap(s=>orderQuestions(QUESTIONS.filter(q=>q.subject===s.id)).slice(0,1));
 }
 const primary=orderQuestions(pool).slice(0,5);
 const need=5-primary.length;
 if(need>0)primary.push(...orderQuestions(extra).slice(0,need));
 return shuffle(primary);
}
function start(subject=null,unit=null){
 clearWarn();
 const qs=choose(subject,unit);
 if(qs.length!==5){warn("この学習には、まだ十分な問題がありません。");return}
 selectedSubject=subject;selectedUnit=unit;
 session={qs,i:0,chosen:null,correct:0,earnedXP:0,earnedCoin:0,earnedHeart:0,
   originalSubject:subject,originalUnit:unit};
 renderQuiz();view("quizView");
 if(!storage()?.activePet)warn("経験値やコインを受け取るには、先に「育成・島へ戻る」から仲間を選んでください。");
}
function renderQuiz(){
 const q=session.qs[session.i];
 const s=subjectById.get(q.subject),u=unitById.get(q.unit);
 $("qSubject").textContent=(s?.icon||"📘")+" "+(s?.name||"学習");
 $("qUnit").textContent=u?.name||"5問チャレンジ";
 $("qCounter").textContent=(session.i+1)+" / 5 問";
 $("progressBar").style.width=(session.i/5*100)+"%";
 $("qTag").textContent="QUESTION "+(session.i+1);
 $("qPrompt").textContent=q.prompt;
 $("feedback").hidden=true;
 const wrap=$("answers");wrap.replaceChildren();
 for(const [i,option] of q.options.entries()){
  const b=button("","",()=>answer(q,option));
  b.append(txt("b","",["A","B","C","D"][i]),txt("span","",option));
  wrap.append(b);
 }
}
function reward(q,correct){
 const g=storage();
 if(!g||!g.activePet||!g.pets[g.activePet])return {xp:0,coins:0,heart:0};
 const old=g.records[q.id]||null,now=Date.now();
 const days=old?(now-old.lastAt)/86400000:0,useful=!old||days>=1;
 const xp=correct?(!old?.firstReward?10:useful?12:0):(!old||useful?3:0);
 const heart=useful?(correct?2:1):0,coins=useful?(correct?6:2):0;
 const record={
  attempts:(old?.attempts||0)+1,
  correct:(old?.correct||0)+(correct?1:0),
  failures:(old?.failures||0)+(correct?0:1),
  lastAt:now,
  firstReward:!!old?.firstReward||correct,
  spacedRewardAt:days>=1&&correct?now:old?.spacedRewardAt||0,
  mastery:correct?Math.min(4,(old?.mastery||0)+(days>=1||!old?.mastery?1:0)):
    Math.max(0,(old?.mastery||0)-1)
 };
 const pet=g.pets[g.activePet];
 const next={...g,xp:g.xp+xp,coins:g.coins+coins,
   pets:{...g.pets,[g.activePet]:{...pet,friend:pet.friend+heart}},
   records:{...g.records,[q.id]:record}};
 if(!save(next))return {xp:0,coins:0,heart:0};
 return {xp,coins,heart};
}
function answer(q,choice){
 if(!session||session.chosen!==null)return;
 const correct=choice===q.answer;
 session.chosen=choice;
 if(correct)session.correct++;
 const gained=reward(q,correct);
 session.earnedXP+=gained.xp;session.earnedCoin+=gained.coins;session.earnedHeart+=gained.heart;
 for(const b of $("answers").children){
  const option=b.querySelector("span").textContent;
  b.disabled=true;
  if(option===q.answer)b.classList.add("correct");
  else if(option===choice)b.classList.add("wrong");
 }
 $("feedbackTitle").textContent=correct?"🎉 正解！":"💡 よいチャレンジ！";
 $("feedbackText").textContent=q.explain+"　正しい答え："+q.answer;
 $("feedback").hidden=false;
 $("nextButton").textContent=session.i===4?"結果を見る →":"次の問題 →";
 $("progressBar").style.width=((session.i+1)/5*100)+"%";
 stats();
}
function next(){
 if(!session||session.chosen===null)return;
 if(session.i<4){
  session.i++;session.chosen=null;renderQuiz();
  return;
 }
 const g=storage();
 if(g&&g.activePet){
  const meaningful=session.earnedXP>0,eggs=meaningful&&(g.missions+1)%3===0?1:0;
  const bonus=meaningful?10:0;
  if(save({...g,missions:g.missions+1,coins:g.coins+bonus,eggs:g.eggs+eggs})){
   session.earnedCoin+=bonus;
   if(eggs)warn("🥚 新しいタマゴを1こ手に入れました！");
  }
 }
 $("resultSentence").textContent="5問中 "+session.correct+"問 正解！ 学びが仲間の力になりました。";
 $("earnedXP").textContent="+"+session.earnedXP;
 $("earnedCoin").textContent="+"+session.earnedCoin;
 $("earnedHeart").textContent="+"+session.earnedHeart;
 view("resultView");stats();
}
function bind(){
 $("mixButton").addEventListener("click",()=>start());
 $("backSubjects").addEventListener("click",()=>{renderSubjects();view("catalog")});
 $("randomSubject").addEventListener("click",()=>start(selectedSubject));
 $("backUnits").addEventListener("click",()=>{
  if(selectedSubject){renderUnits();view("unitsView")}
  else{renderSubjects();view("catalog")}
 });
 $("nextButton").addEventListener("click",next);
 $("againButton").addEventListener("click",()=>start(session?.originalSubject,session?.originalUnit));
 $("otherButton").addEventListener("click",()=>{renderSubjects();view("catalog")});
 window.addEventListener("pageshow",stats);
}
if(new Set(QUESTIONS.map(q=>q.id)).size!==QUESTIONS.length)throw Error("Duplicate curriculum question IDs");
bind();renderSubjects();view("catalog");
