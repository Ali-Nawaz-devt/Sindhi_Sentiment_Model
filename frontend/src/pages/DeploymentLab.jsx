import React, { useState, useEffect, useRef } from 'react'
import { predict, getAvailableModels, trainModel } from '../utils/api'
import PlotlyChart from '../components/PlotlyChart'

const C = {
  ajrak1:'#C84B31', saffron:'#E8B84B', indigo:'#2C4A7C', teal:'#1A6B6B',
  lr:'#60A5FA', svm:'#A78BFA', nb:'#34D399',
  pos:'#4ADE80', neg:'#F87171', neu:'#FBBF24',
  bg:'#04080f', card:'#080e1c', elev:'#0c1425', border:'#172035',
  dim:'#2e4060', muted:'#4a6080', text:'#c9d1d9',
}
const MODEL_COLORS = { 'Logistic Regression':C.lr, 'SVM (LinearSVC)':C.svm, 'Naive Bayes':C.nb }
const ALL_MODELS   = ['Logistic Regression','SVM (LinearSVC)','Naive Bayes']
const SENT_COLORS  = { Positive:C.pos, Negative:C.neg, Neutral:C.neu }
const SENT_EMOJI   = { Positive:'😊', Negative:'😔', Neutral:'😐' }
const SENT_ARABIC  = { Positive:'مثبت', Negative:'منفي', Neutral:'غير جانبدار' }

const SAMPLE_TEXTS = [
  {label:'😊 Positive',sentiment:'Positive',text:'اڄ جو ڏينهن تمام سٺو آهي، مون پنهنجو امتحان پاس ڪيو ۽ مون کي تمام خوشي آهي'},
  {label:'😔 Negative',sentiment:'Negative',text:'مان تمام ٿڪل آهيان ۽ خوش نه آهيان، ڪجهه به سٺو نه آهي، زندگي ڏکي آهي'},
  {label:'😐 Neutral', sentiment:'Neutral', text:'اسان جي اسڪول ۾ اڄ ڪلاس هو ۽ استاد سبق پڙهايو، پوءِ اسان گهر ويا'},
  {label:'😊 Positive (formal)',sentiment:'Positive',text:'هن ڪتاب ۾ علم ۽ حڪمت جا گوهر آهن، ماڻهن کي ضرور پڙهڻ گهرجي'},
  {label:'😔 Negative (news)',sentiment:'Negative',text:'ضلعي ۾ وڏي ٻوڏ آئي، ڪيترائي گهر تباهه ٿيا ۽ ماڻهو بي گهر ٿيا'},
]

const DARK_LAYOUT = {
  paper_bgcolor:'transparent', plot_bgcolor:'#060c18',
  font:{color:C.text,family:'Space Mono, monospace',size:11},
  xaxis:{gridcolor:'#172035',zerolinecolor:'#172035'},
  yaxis:{gridcolor:'#172035',zerolinecolor:'#172035'},
  legend:{bgcolor:'#060c18',bordercolor:'#172035',borderwidth:1},
  margin:{l:55,r:25,t:45,b:50},
}

const pct = v => v!=null ? `${(v*100).toFixed(1)}%` : '—'

const S = {
  page:{background:C.bg,minHeight:'100vh',fontFamily:`'Space Mono','Courier New',monospace`,color:C.text,paddingBottom:80},
  hero:{padding:'28px 32px 24px',background:`linear-gradient(135deg,#04080f 0%,#080e1c 50%,#0a1228 100%)`,borderBottom:`1px solid ${C.border}`,position:'relative',overflow:'hidden'},
  ajrakBg:{position:'absolute',inset:0,opacity:0.04,pointerEvents:'none',backgroundImage:`repeating-linear-gradient(45deg,${C.ajrak1} 0,${C.ajrak1} 1px,transparent 0,transparent 28px),repeating-linear-gradient(-45deg,${C.saffron} 0,${C.saffron} 1px,transparent 0,transparent 28px)`,backgroundSize:'28px 28px'},
  heroTitle:{fontSize:26,fontWeight:700,letterSpacing:'-0.5px',background:`linear-gradient(90deg,${C.saffron} 0%,${C.ajrak1} 40%,${C.lr} 100%)`,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:4},
  heroSub:{fontSize:10,color:C.muted,letterSpacing:'2.5px',textTransform:'uppercase'},
  tag:c=>({fontSize:9,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',padding:'3px 10px',borderRadius:2,border:`1px solid ${c}40`,color:c,background:`${c}10`}),
  body:{padding:'20px 24px 0',display:'grid',gridTemplateColumns:'310px 1fr',gap:20},
  leftPanel:{display:'flex',flexDirection:'column',gap:12},
  rightPanel:{display:'flex',flexDirection:'column',gap:14},
  card:{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:'16px 18px'},
  cardTitle:{fontSize:9,fontWeight:700,letterSpacing:'2px',textTransform:'uppercase',color:C.muted,marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${C.border}`},
  chip:c=>({display:'inline-block',padding:'3px 9px',borderRadius:2,background:`${c}18`,color:c,fontSize:9,fontWeight:700,letterSpacing:'1px'}),
}

/* ── Chart Builders ── */
const mkProbBar = predResult => {
  if(!predResult?.class_probabilities) return null
  const classes=Object.keys(predResult.class_probabilities)
  const probs=Object.values(predResult.class_probabilities)
  return {
    data:[{
      type:'bar',
      x:classes,y:probs,
      marker:{
        color:classes.map(k=>SENT_COLORS[k]||C.muted),
        opacity:classes.map(k=>k===predResult.prediction?1.0:0.35),
        line:{color:classes.map(k=>k===predResult.prediction?'white':C.border),width:classes.map(k=>k===predResult.prediction?2:1)},
      },
      text:probs.map(v=>`${(v*100).toFixed(1)}%`),textposition:'auto',textfont:{size:11,color:'white'},
      hovertemplate:'%{x}: <b>%{y:.2%}</b><extra></extra>',
    }],
    layout:{...DARK_LAYOUT,height:220,
      title:{text:'Class Probabilities',font:{color:C.text,size:12},x:0.5},
      yaxis:{...DARK_LAYOUT.yaxis,title:'Probability',tickformat:'.0%',range:[0,1.1]},
      margin:{l:55,r:20,t:40,b:55},
    },
  }
}

const mkAllModelsBars = allPreds => {
  if(!allPreds||!Object.keys(allPreds).length) return null
  const models=Object.keys(allPreds).filter(m=>allPreds[m]?.class_probabilities)
  if(!models.length) return null
  const classes=['Negative','Neutral','Positive']
  return {
    data: classes.map(cls=>({
      type:'bar',name:cls,
      x:models.map(m=>m.replace(' (LinearSVC)','')),
      y:models.map(m=>allPreds[m]?.class_probabilities?.[cls]||0),
      marker:{color:SENT_COLORS[cls],opacity:0.85},
      text:models.map(m=>`${((allPreds[m]?.class_probabilities?.[cls]||0)*100).toFixed(0)}%`),
      textposition:'auto',textfont:{size:9,color:'white'},
      hovertemplate:`<b>%{x}</b><br>${cls}: %{y:.2%}<extra></extra>`,
    })),
    layout:{...DARK_LAYOUT,barmode:'group',height:280,
      title:{text:'All Models — Side-by-Side Probability Comparison',font:{color:C.text,size:13},x:0.5},
      yaxis:{...DARK_LAYOUT.yaxis,title:'Probability',tickformat:'.0%',range:[0,1.1]},
      showlegend:true,
    },
  }
}

const mkHistoryPie = history => {
  if(!history.length) return null
  const counts={Positive:0,Negative:0,Neutral:0}
  history.forEach(h=>{if(counts[h.prediction]!==undefined)counts[h.prediction]++})
  return {
    data:[{
      type:'pie',
      labels:Object.keys(counts),values:Object.values(counts),
      hole:0.55,
      marker:{colors:[C.pos,C.neg,C.neu],line:{color:C.border,width:2}},
      textinfo:'percent+label',textfont:{size:10,color:C.text},
      hovertemplate:'%{label}: %{value} (%{percent})<extra></extra>',
    }],
    layout:{
      paper_bgcolor:'transparent',height:200,
      font:{color:C.text,family:'Space Mono',size:10},
      margin:{l:10,r:10,t:10,b:10},
      showlegend:false,
    },
  }
}

const mkConfidenceHist = history => {
  if(history.length<3) return null
  return {
    data:[{
      type:'histogram',x:history.map(h=>h.confidence),
      marker:{color:C.ajrak1,opacity:0.8,line:{color:C.saffron,width:1}},
      nbinsx:10,
      hovertemplate:'Confidence: %{x:.2f}<br>Count: %{y}<extra></extra>',
    }],
    layout:{...DARK_LAYOUT,height:200,
      title:{text:'Prediction Confidence Distribution',font:{color:C.text,size:12},x:0.5},
      xaxis:{...DARK_LAYOUT.xaxis,title:'Confidence',tickformat:'.0%'},
      yaxis:{...DARK_LAYOUT.yaxis,title:'Count'},
      margin:{l:50,r:20,t:40,b:50},
    },
  }
}

const mkModelAgreement = allPreds => {
  if(!allPreds||Object.keys(allPreds).length<2) return null
  const models=Object.keys(allPreds).filter(m=>allPreds[m]?.prediction)
  if(models.length<2) return null
  const predictions=models.map(m=>allPreds[m]?.prediction||'Unknown')
  const agreement=predictions.every(p=>p===predictions[0])
  const uniquePreds=[...new Set(predictions)]
  return {
    data:[{
      type:'scatter',mode:'markers+text',
      x:models.map((_,i)=>i),
      y:models.map(m=>['Negative','Neutral','Positive'].indexOf(allPreds[m]?.prediction||'Neutral')),
      text:models.map(m=>`${m.replace(' (LinearSVC)','')}<br>${allPreds[m]?.prediction}`),
      textposition:'top center',textfont:{size:9},
      marker:{
        size:models.map(m=>Math.max(20,allPreds[m]?.confidence*40||20)),
        color:models.map(m=>SENT_COLORS[allPreds[m]?.prediction]||C.muted),
        opacity:0.85,
        line:{color:'white',width:2},
      },
      hovertemplate:'<b>%{text}</b><br>Confidence: %{marker.size:.0f}%<extra></extra>',
    }],
    layout:{...DARK_LAYOUT,height:220,
      title:{text:`Model Agreement: ${agreement?'✅ All Agree':'⚠️ Models Disagree'} (${uniquePreds.join(' vs ')})`,font:{color:agreement?C.pos:C.neg,size:12},x:0.5},
      xaxis:{...DARK_LAYOUT.xaxis,tickvals:models.map((_,i)=>i),ticktext:models.map(m=>m.replace(' (LinearSVC)','')),title:''},
      yaxis:{...DARK_LAYOUT.yaxis,tickvals:[0,1,2],ticktext:['Negative','Neutral','Positive'],title:''},
      margin:{l:80,r:20,t:50,b:70},
    },
  }
}

const mkHistoryTimeline = history => {
  if(history.length<2) return null
  const byModel={}
  history.forEach((h,i)=>{
    if(!byModel[h.model]) byModel[h.model]=[]
    byModel[h.model].push({idx:history.length-1-i,confidence:h.confidence,sentiment:h.prediction})
  })
  return {
    data: Object.entries(byModel).map(([model,pts])=>({
      type:'scatter',name:model.replace(' (LinearSVC)',''),
      x:pts.map(p=>p.idx),y:pts.map(p=>p.confidence),
      mode:'lines+markers',
      line:{color:MODEL_COLORS[model]||C.lr,width:2},
      marker:{size:8,color:pts.map(p=>SENT_COLORS[p.sentiment]||C.muted),line:{color:'white',width:1}},
      hovertemplate:'Pred #%{x}<br>Confidence: %{y:.2%}<extra></extra>',
    })),
    layout:{...DARK_LAYOUT,height:240,
      title:{text:'Confidence Timeline by Model (colored=sentiment)',font:{color:C.text,size:12},x:0.5},
      xaxis:{...DARK_LAYOUT.xaxis,title:'Prediction Index',autorange:'reversed'},
      yaxis:{...DARK_LAYOUT.yaxis,title:'Confidence',tickformat:'.0%'},
      showlegend:true,
    },
  }
}

export default function DeploymentLab() {
  const [trainedModels, setTrained]   = useState([])
  const [selectedModel, setSelected]  = useState('')
  const [text, setText]               = useState('')
  const [predResult, setPred]         = useState(null)
  const [allPreds, setAllPreds]       = useState({})
  const [history, setHistory]         = useState([])
  const [loading, setLoading]         = useState(false)
  const [multiLoading, setMultiLoad]  = useState(false)
  const [training, setTraining]       = useState(null)
  const [error, setError]             = useState(null)
  const [showAll, setShowAll]         = useState(false)
  const textRef = useRef(null)

  useEffect(()=>{
    getAvailableModels().then(d=>{
      const trained=d.trained||[]
      setTrained(trained)
      if(trained.length>0) setSelected(trained[0])
    }).catch(()=>{})
  },[])

  const handleAutoTrain = async modelName => {
    setTraining(modelName); setError(null)
    try{
      const params={'Logistic Regression':{C:1.0,max_iter:2000},'SVM (LinearSVC)':{C:0.8,max_iter:3000},'Naive Bayes':{alpha:0.3}}
      await trainModel({model_name:modelName,params:params[modelName]||{},test_size:0.2,val_size:0.1,cv_folds:5})
      const d=await getAvailableModels()
      setTrained(d.trained||[])
      setSelected(modelName)
    }catch(e){setError(e?.response?.data?.detail||e.message)}
    finally{setTraining(null)}
  }

  const handlePredict = async () => {
    if(!text.trim()){setError('Enter Sindhi text first.');return}
    if(!selectedModel){setError('No trained model selected.');return}
    setLoading(true); setError(null); setPred(null)
    try{
      const r=await predict({text:text.trim(),model_name:selectedModel})
      setPred(r)
      setHistory(prev=>[{...r,model:selectedModel,text:text.trim(),time:new Date().toLocaleTimeString()},...prev.slice(0,29)])
    }catch(e){setError(e?.response?.data?.detail||e.message||'Prediction failed')}
    finally{setLoading(false)}
  }

  const handlePredictAll = async () => {
    if(!text.trim()){setError('Enter Sindhi text first.');return}
    if(trainedModels.length===0){setError('No trained models available. Train models in Model Lab first.');return}
    setMultiLoad(true); setError(null)
    const newPreds={}
    for(const model of trainedModels){
      try{
        const r=await predict({text:text.trim(),model_name:model})
        newPreds[model]=r
      }catch{}
    }
    setAllPreds(newPreds)
    setMultiLoad(false)
    setShowAll(true)
    if(Object.keys(newPreds).length>0){
      const firstResult=Object.values(newPreds)[0]
      setPred({...firstResult,model_name:selectedModel})
      setHistory(prev=>[...Object.entries(newPreds).map(([model,r])=>({...r,model,text:text.trim(),time:new Date().toLocaleTimeString()})),...prev.slice(0,25)])
    }
  }

  const probChart      = predResult    ? mkProbBar(predResult)               : null
  const allModelsChart = showAll       ? mkAllModelsBars(allPreds)           : null
  const pieChart       = history.length? mkHistoryPie(history)               : null
  const confHist       = history.length>3?mkConfidenceHist(history)         : null
  const agreeChart     = showAll&&Object.keys(allPreds).length>1 ? mkModelAgreement(allPreds) : null
  const timelineChart  = history.length>2 ? mkHistoryTimeline(history)      : null

  return (
    <div style={S.page}>
      {/* Hero */}
      <div style={S.hero}>
        <div style={S.ajrakBg}/>
        <div style={{position:'relative',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:6}}>
              <span style={{fontSize:32}}>🚀</span>
              <div style={S.heroTitle}>Deployment Lab</div>
            </div>
            <div style={S.heroSub}>Live Sindhi Sentiment Prediction · All Models · Real-Time Analysis</div>
            <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
              {['Live Inference','All Models','Confidence Analysis','Prediction History','سنڌي'].map((t,i)=>(
                <span key={t} style={S.tag([C.lr,C.svm,C.nb,C.saffron,C.teal][i])}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={S.body}>
        {/* LEFT PANEL */}
        <div style={S.leftPanel}>

          {/* Model Status Panel */}
          <div style={S.card}>
            <div style={S.cardTitle}>🤖 Available Models</div>
            {ALL_MODELS.map(m=>{
              const isTrained=trainedModels.includes(m)
              const isSelected=selectedModel===m
              const isTraining=training===m
              return(
                <div key={m} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',borderRadius:7,marginBottom:8,border:`1px solid ${isSelected&&isTrained?MODEL_COLORS[m]+'50':C.border}`,background:isSelected&&isTrained?`${MODEL_COLORS[m]}0c`:C.elev,transition:'all .15s'}}>
                  <div>
                    <button onClick={()=>isTrained?setSelected(m):null}
                      style={{background:'none',border:'none',cursor:isTrained?'pointer':'default',color:isTrained?(isSelected?MODEL_COLORS[m]:C.text):C.dim,fontFamily:'Space Mono,sans-serif',fontSize:11,fontWeight:700,padding:0,textAlign:'left',display:'block'}}>
                      {m}
                    </button>
                    <div style={{fontSize:9,color:isTrained?C.pos:C.dim,marginTop:3}}>
                      {isTrained?'✓ Ready for prediction':'Not trained yet — train in Model Lab'}
                    </div>
                  </div>
                  {isTrained
                    ? <span style={S.chip(isSelected?MODEL_COLORS[m]:C.pos)}>{isSelected?'ACTIVE':'READY'}</span>
                    : <button onClick={()=>handleAutoTrain(m)} disabled={!!training}
                        style={{padding:'5px 12px',borderRadius:4,border:`1px solid ${C.ajrak1}50`,background:'transparent',color:C.ajrak1,fontSize:9,fontWeight:700,cursor:training?'not-allowed':'pointer'}}>
                        {isTraining?'⏳...':'Quick Train'}
                      </button>
                  }
                </div>
              )
            })}
          </div>

          {/* Sample Texts */}
          <div style={S.card}>
            <div style={S.cardTitle}>📝 Sample Texts</div>
            {SAMPLE_TEXTS.map(s=>(
              <button key={s.label} onClick={()=>setText(s.text)}
                style={{width:'100%',padding:'10px 12px',background:C.elev,border:`1px solid ${SENT_COLORS[s.sentiment]}25`,borderRadius:6,cursor:'pointer',textAlign:'left',marginBottom:6,transition:'all .15s'}}>
                <div style={{fontSize:10,fontWeight:700,color:SENT_COLORS[s.sentiment],marginBottom:4}}>{s.label}</div>
                <div style={{direction:'rtl',fontFamily:'serif',color:C.text,fontSize:12,lineHeight:1.5}}>{s.text.slice(0,55)}…</div>
              </button>
            ))}
          </div>

          {/* Session Stats */}
          {history.length>0&&(
            <div style={S.card}>
              <div style={S.cardTitle}>📊 Session Stats</div>
              {pieChart&&<PlotlyChart data={pieChart.data} layout={pieChart.layout}/>}
              <div style={{display:'flex',justifyContent:'space-between',marginTop:10,fontSize:10,color:C.muted}}>
                <span>{history.length} predictions</span>
                <span>{[...new Set(history.map(h=>h.model))].length} model{[...new Set(history.map(h=>h.model))].length!==1?'s':''} used</span>
              </div>
              {confHist&&<PlotlyChart data={confHist.data} layout={confHist.layout}/>}
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div style={S.rightPanel}>

          {/* Text input */}
          <div style={S.card}>
            <div style={S.cardTitle}>🖊️ Enter Sindhi Text</div>
            <textarea ref={textRef}
              style={{width:'100%',minHeight:110,background:'#06101e',border:`1px solid ${C.border}`,borderRadius:6,padding:'12px 14px',color:C.text,fontFamily:'serif',fontSize:16,lineHeight:1.8,direction:'rtl',resize:'vertical',outline:'none',boxSizing:'border-box'}}
              placeholder="ھتي سنڌي متن لکو... (Type or paste Sindhi text here)"
              value={text} onChange={e=>setText(e.target.value)}
            />
            <div style={{display:'flex',gap:10,marginTop:12,flexWrap:'wrap'}}>
              <button onClick={handlePredict} disabled={loading||!!training||!selectedModel||!text.trim()}
                style={{padding:'11px 24px',borderRadius:6,border:'none',cursor:(loading||!selectedModel||!text.trim())?'not-allowed':'pointer',background:(loading||!selectedModel||!text.trim())?C.border:`linear-gradient(135deg,${C.ajrak1},#8B1A1A)`,color:(loading||!selectedModel||!text.trim())?C.muted:'#fff',fontSize:12,fontWeight:700,letterSpacing:'1px',boxShadow:(loading||!selectedModel||!text.trim())?'none':`0 4px 20px ${C.ajrak1}40`}}>
                {loading?'⏳ Predicting...':'🔮 Predict (Active Model)'}
              </button>
              <button onClick={handlePredictAll} disabled={multiLoading||trainedModels.length===0||!text.trim()}
                style={{padding:'11px 24px',borderRadius:6,border:`1px solid ${C.saffron}50`,cursor:(multiLoading||trainedModels.length===0||!text.trim())?'not-allowed':'pointer',background:(multiLoading||trainedModels.length===0||!text.trim())?'transparent':`${C.saffron}0a`,color:(multiLoading||trainedModels.length===0||!text.trim())?C.muted:C.saffron,fontSize:12,fontWeight:700,letterSpacing:'0.5px'}}>
                {multiLoading?'⏳ Running All...':'⚡ Predict All Models'}
              </button>
              <button onClick={()=>{setText('');setPred(null);setAllPreds({});setShowAll(false);setError(null)}}
                style={{padding:'11px 18px',borderRadius:6,border:`1px solid ${C.border}`,background:'transparent',color:C.muted,fontSize:11,cursor:'pointer'}}>
                Clear
              </button>
            </div>
            {error&&<div style={{marginTop:12,padding:'10px 14px',borderRadius:5,background:'#140808',border:`1px solid ${C.neg}40`,fontSize:10,color:C.neg}}>{error}</div>}
          </div>

          {/* Main prediction result */}
          {predResult&&!loading&&(
            <div style={{...S.card,border:`1px solid ${SENT_COLORS[predResult.prediction]}40`,background:`linear-gradient(135deg,${SENT_COLORS[predResult.prediction]}05,${C.card})`}}>
              <div style={{display:'flex',alignItems:'center',gap:20,marginBottom:20}}>
                <div style={{fontSize:60,lineHeight:1}}>{SENT_EMOJI[predResult.prediction]}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:32,fontWeight:700,color:SENT_COLORS[predResult.prediction],letterSpacing:'-0.02em',marginBottom:4}}>
                    {predResult.prediction}
                    <span style={{fontSize:16,fontWeight:400,color:C.muted,marginLeft:12,direction:'rtl',fontFamily:'serif'}}>{SENT_ARABIC[predResult.prediction]}</span>
                  </div>
                  <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
                    <span style={{fontSize:12,color:C.muted}}>Confidence: <strong style={{color:SENT_COLORS[predResult.prediction],fontFamily:'Space Mono'}}>{pct(predResult.confidence)}</strong></span>
                    <span style={{fontSize:12,color:C.muted}}>Model: <strong style={{color:MODEL_COLORS[selectedModel]}}>{selectedModel}</strong></span>
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:36,fontWeight:700,color:SENT_COLORS[predResult.prediction],fontFamily:'Space Mono'}}>{pct(predResult.confidence)}</div>
                  <div style={{fontSize:8,color:C.muted,letterSpacing:'1.5px'}}>CONFIDENCE</div>
                </div>
              </div>

              {/* Confidence bar */}
              <div style={{height:8,background:C.border,borderRadius:4,marginBottom:16,overflow:'hidden'}}>
                <div style={{width:`${predResult.confidence*100}%`,height:'100%',background:`linear-gradient(90deg,${SENT_COLORS[predResult.prediction]}80,${SENT_COLORS[predResult.prediction]})`,borderRadius:4,transition:'width .5s'}}/>
              </div>

              {/* Probability chart */}
              {probChart&&<PlotlyChart data={probChart.data} layout={probChart.layout}/>}

              {/* Cleaned text */}
              <div style={{marginTop:12,padding:'12px 14px',background:C.elev,borderRadius:6,border:`1px solid ${C.border}`}}>
                <div style={{fontSize:9,color:C.muted,letterSpacing:'2px',textTransform:'uppercase',marginBottom:6}}>Cleaned Text (after preprocessing)</div>
                <div style={{fontSize:13,direction:'rtl',fontFamily:'serif',color:C.text,lineHeight:1.8}}>{predResult.cleaned_text}</div>
              </div>
            </div>
          )}

          {/* All-models comparison */}
          {showAll&&Object.keys(allPreds).length>0&&(
            <div style={S.card}>
              <div style={S.cardTitle}>⚡ All Models — Live Comparison</div>

              {/* Individual model results */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
                {ALL_MODELS.map(m=>{
                  const r=allPreds[m]
                  if(!r) return(
                    <div key={m} style={{padding:'14px',background:C.elev,borderRadius:6,border:`1px solid ${C.border}`,textAlign:'center',color:C.dim}}>
                      <div style={{fontSize:10,fontWeight:700,color:MODEL_COLORS[m],marginBottom:6}}>{m.replace(' (LinearSVC)','')}</div>
                      <div style={{fontSize:9}}>Not trained</div>
                    </div>
                  )
                  return(
                    <div key={m} style={{padding:'14px',background:C.elev,borderRadius:7,border:`1px solid ${MODEL_COLORS[m]}40`,cursor:'pointer'}}
                      onClick={()=>{setSelected(m);setPred(r)}}>
                      <div style={{fontSize:9,fontWeight:700,color:MODEL_COLORS[m],textTransform:'uppercase',marginBottom:8}}>{m.replace(' (LinearSVC)','')}</div>
                      <div style={{fontSize:24,marginBottom:4}}>{SENT_EMOJI[r.prediction]}</div>
                      <div style={{fontSize:14,fontWeight:700,color:SENT_COLORS[r.prediction],marginBottom:6}}>{r.prediction}</div>
                      <div style={{fontSize:11,color:C.muted,fontFamily:'Space Mono',marginBottom:8}}>{pct(r.confidence)}</div>
                      {/* Mini prob bars */}
                      {['Negative','Neutral','Positive'].map(cls=>(
                        <div key={cls} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                          <div style={{fontSize:8,color:C.muted,width:40}}>{cls.slice(0,3)}</div>
                          <div style={{flex:1,height:4,background:C.border,borderRadius:2}}>
                            <div style={{width:`${(r.class_probabilities?.[cls]||0)*100}%`,height:'100%',background:SENT_COLORS[cls],borderRadius:2}}/>
                          </div>
                          <div style={{fontSize:8,color:SENT_COLORS[cls],fontFamily:'Space Mono',width:30,textAlign:'right'}}>{pct(r.class_probabilities?.[cls])}</div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>

              {allModelsChart&&<PlotlyChart data={allModelsChart.data} layout={allModelsChart.layout}/>}
              {agreeChart&&<PlotlyChart data={agreeChart.data} layout={agreeChart.layout}/>}
            </div>
          )}

          {/* History timeline */}
          {history.length>0&&(
            <div style={S.card}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${C.border}`}}>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:'2px',textTransform:'uppercase',color:C.muted}}>Prediction History</div>
                <span style={{fontSize:10,color:C.muted,fontFamily:'Space Mono'}}>{history.length} records</span>
              </div>

              {timelineChart&&<PlotlyChart data={timelineChart.data} layout={timelineChart.layout}/>}

              <div style={{maxHeight:320,overflowY:'auto',marginTop:14}}>
                {history.map((h,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:`1px solid ${C.border}`,cursor:'pointer'}}
                    onClick={()=>setText(h.text)}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{direction:'rtl',fontFamily:'serif',fontSize:12,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {h.text.slice(0,55)}{h.text.length>55?'…':''}
                      </div>
                      <div style={{fontSize:9,color:C.muted,marginTop:3,display:'flex',gap:10}}>
                        <span style={{color:MODEL_COLORS[h.model]||C.muted}}>{h.model?.replace(' (LinearSVC)','')}</span>
                        <span>{h.time}</span>
                      </div>
                    </div>
                    <div style={{marginLeft:14,display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
                      <span style={{fontSize:12,fontWeight:700,color:SENT_COLORS[h.prediction]}}>{SENT_EMOJI[h.prediction]} {h.prediction}</span>
                      <span style={{fontSize:10,color:C.muted,fontFamily:'Space Mono'}}>{pct(h.confidence)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!predResult&&!showAll&&!loading&&!multiLoading&&(
            <div style={{...S.card,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:350,color:C.dim,gap:14}}>
              <div style={{fontSize:70,opacity:0.2}}>🔮</div>
              <div style={{fontSize:16,fontWeight:700,color:C.dim}}>Ready for prediction</div>
              <div style={{fontSize:11,color:'#1e2d44',textAlign:'center',maxWidth:340,lineHeight:1.7}}>
                Enter Sindhi text and click <strong style={{color:C.ajrak1}}>🔮 Predict</strong> to classify with the active model,
                or <strong style={{color:C.saffron}}>⚡ Predict All Models</strong> to compare all trained models simultaneously.
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginTop:8,width:'100%',maxWidth:360}}>
                {SAMPLE_TEXTS.slice(0,3).map(s=>(
                  <button key={s.label} onClick={()=>setText(s.text)}
                    style={{padding:'10px 8px',borderRadius:5,border:`1px solid ${SENT_COLORS[s.sentiment]}30`,background:`${SENT_COLORS[s.sentiment]}08`,color:SENT_COLORS[s.sentiment],fontSize:10,fontWeight:700,cursor:'pointer',textAlign:'center'}}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}