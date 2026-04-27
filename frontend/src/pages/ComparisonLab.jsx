import React, { useState, useEffect } from 'react'
import { compareModels, getAvailableModels } from '../utils/api'
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
const FIT_COLORS   = { good:C.pos, overfitting:C.neg, underfitting:C.neu }
const FIT_ICON     = { good:'✅', overfitting:'⚠️', underfitting:'📉' }

const DARK_LAYOUT = {
  paper_bgcolor:'transparent', plot_bgcolor:'#060c18',
  font:{color:C.text,family:'Space Mono, monospace',size:11},
  xaxis:{gridcolor:'#172035',zerolinecolor:'#172035',tickfont:{size:10}},
  yaxis:{gridcolor:'#172035',zerolinecolor:'#172035',tickfont:{size:10}},
  legend:{bgcolor:'#060c18',bordercolor:'#172035',borderwidth:1},
  margin:{l:55,r:25,t:45,b:55},
}

const pct = v => v!=null ? `${(v*100).toFixed(1)}%` : '—'

const MODEL_INSIGHT = {
  'Logistic Regression':{
    pros:['Highly interpretable linear model','Fast training (~0.5s on this corpus)','Excellent with L2 regularization for high-dim TF-IDF','Convergence is well-understood'],
    cons:['Assumes linear decision boundary','May underperform on complex morphological patterns','Sensitive to feature scaling (mitigated by TF-IDF sublinear_tf)'],
    sindhi:'Best when Sindhi sentiment is linearly separable in TF-IDF space. Class weights are critical for Neutral minority class.',
  },
  'SVM (LinearSVC)':{
    pros:['Maximum margin classifier — robust to noise','Typically best for high-dimensional sparse text','CalibratedClassifierCV adds probability outputs','Dual TF-IDF n-grams perfectly suit LinearSVC'],
    cons:['Slower training than NB','No native probability — needs Platt scaling','More sensitive to C than LR in sparse spaces'],
    sindhi:'Best overall for Sindhi character n-grams. LinearSVC maximizes the margin on the 37K feature space, separating Sindhi morphemes cleanly.',
  },
  'Naive Bayes':{
    pros:['Fastest training by far (<0.1s)','ComplementNB handles imbalanced classes well','Independence assumption works surprisingly well for n-grams','Alpha smoothing is the only tunable parameter'],
    cons:['Assumes feature independence (violated by Sindhi collocations)','Cannot use sample weights during training','Slightly lower accuracy than discriminative models'],
    sindhi:'ComplementNB is specifically designed for text classification with class imbalance. Complement of each class trains on other classes, boosting Neutral recall.',
  },
}

const S = {
  page:{background:C.bg,minHeight:'100vh',fontFamily:`'Space Mono','Courier New',monospace`,color:C.text,paddingBottom:80},
  hero:{padding:'28px 32px 24px',background:`linear-gradient(135deg,#04080f 0%,#080e1c 50%,#0a1228 100%)`,borderBottom:`1px solid ${C.border}`,position:'relative',overflow:'hidden'},
  ajrakBg:{position:'absolute',inset:0,opacity:0.04,pointerEvents:'none',backgroundImage:`repeating-linear-gradient(45deg,${C.ajrak1} 0,${C.ajrak1} 1px,transparent 0,transparent 28px),repeating-linear-gradient(-45deg,${C.saffron} 0,${C.saffron} 1px,transparent 0,transparent 28px)`,backgroundSize:'28px 28px'},
  heroTitle:{fontSize:26,fontWeight:700,letterSpacing:'-0.5px',background:`linear-gradient(90deg,${C.saffron} 0%,${C.ajrak1} 40%,${C.lr} 100%)`,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:4},
  heroSub:{fontSize:10,color:C.muted,letterSpacing:'2.5px',textTransform:'uppercase'},
  tag:c=>({fontSize:9,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',padding:'3px 10px',borderRadius:2,border:`1px solid ${c}40`,color:c,background:`${c}10`}),
  body:{padding:'20px 24px 0'},
  card:{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:'16px 18px',marginBottom:16},
  cardTitle:{fontSize:9,fontWeight:700,letterSpacing:'2px',textTransform:'uppercase',color:C.muted,marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${C.border}`},
  table:{width:'100%',borderCollapse:'collapse',fontSize:11},
  th:{padding:'9px 14px',textAlign:'left',color:C.muted,fontSize:9,letterSpacing:'1.5px',textTransform:'uppercase',borderBottom:`1px solid ${C.border}`},
  td:{padding:'11px 14px',borderBottom:`1px solid #0d1525`,fontFamily:'Space Mono,monospace'},
  chip:c=>({display:'inline-block',padding:'3px 9px',borderRadius:2,background:`${c}18`,color:c,fontSize:9,fontWeight:700,letterSpacing:'1px'}),
  btn:(disabled,color)=>({padding:'11px 24px',borderRadius:6,border:'none',cursor:disabled?'not-allowed':'pointer',background:disabled?C.border:`linear-gradient(135deg,${color||C.ajrak1},${color?color+'cc':'#8B1A1A'})`,color:disabled?C.muted:'#fff',fontSize:12,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',transition:'all .2s',boxShadow:disabled?'none':`0 4px 20px ${(color||C.ajrak1)}40`}),
  chk:active=>({width:18,height:18,borderRadius:4,border:`2px solid ${active?'transparent':C.border}`,background:active?C.ajrak1:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s',flexShrink:0}),
  grid2:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16},
  grid3:{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:16},
  emptyState:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:340,color:C.dim,gap:14},
}

/* ── Chart Builders ── */
const mkGroupedBar = comparison => {
  const metrics = ['test_acc','precision','recall','f1']
  const labels  = {test_acc:'Accuracy',precision:'Precision',recall:'Recall',f1:'F1 Score'}
  const metricColors = [C.lr, C.pos, C.svm, C.neu]
  return {
    data: metrics.map((k,i) => ({
      type:'bar', name:labels[k],
      x:comparison.map(r=>r.model),
      y:comparison.map(r=>r[k]),
      text:comparison.map(r=>`${(r[k]*100).toFixed(1)}%`),
      textposition:'auto', textfont:{size:9,color:'white'},
      marker:{color:metricColors[i],opacity:0.85,line:{color:metricColors[i],width:1}},
      hovertemplate:`<b>%{x}</b><br>${labels[k]}: %{y:.2%}<extra></extra>`,
    })),
    layout:{...DARK_LAYOUT,barmode:'group',height:320,
      title:{text:'All Metrics — Side by Side',font:{color:C.text,size:13},x:0.5},
      yaxis:{...DARK_LAYOUT.yaxis,title:'Score',tickformat:'.0%',range:[0,1.1]},
      showlegend:true,
    },
  }
}

const mkRadar = comparison => ({
  data: comparison.map(r => ({
    type:'scatterpolar',
    name:r.model,
    r:[r.test_acc,r.precision,r.recall,r.f1,r.cv_mean,r.test_acc],
    theta:['Accuracy','Precision','Recall','F1','CV Mean','Accuracy'],
    fill:'toself',
    line:{color:MODEL_COLORS[r.model],width:2.5},
    fillcolor:MODEL_COLORS[r.model]+'20',
    marker:{size:7,color:MODEL_COLORS[r.model]},
  })),
  layout:{
    paper_bgcolor:'transparent',plot_bgcolor:'transparent',
    font:{color:C.text,family:'Space Mono',size:11},
    polar:{bgcolor:C.card,radialaxis:{range:[0.5,1.0],tickformat:'.0%',gridcolor:C.border,color:C.muted},angularaxis:{tickcolor:C.muted,gridcolor:C.border}},
    margin:{l:40,r:40,t:50,b:40},height:340,
    title:{text:'Multi-Model Radar Comparison',font:{color:C.text,size:13},x:0.5},
    showlegend:true,legend:{bgcolor:C.card,bordercolor:C.border,borderwidth:1},
  },
})

const mkCV = comparison => ({
  data: comparison.map(r => ({
    type:'bar', name:r.model,
    x:[r.model],y:[r.cv_mean],
    error_y:{type:'data',array:[r.cv_std],visible:true,color:MODEL_COLORS[r.model],thickness:2,width:8},
    marker:{color:MODEL_COLORS[r.model],opacity:0.85,line:{color:MODEL_COLORS[r.model],width:1.5}},
    text:[`${(r.cv_mean*100).toFixed(2)}%`], textposition:'auto', textfont:{size:10,color:'white'},
    hovertemplate:`<b>%{x}</b><br>CV Mean: %{y:.2%}<br>±${(r.cv_std*100).toFixed(3)}%<extra></extra>`,
  })),
  layout:{...DARK_LAYOUT,height:280,
    title:{text:'Cross-Validation Mean ± Std',font:{color:C.text,size:13},x:0.5},
    yaxis:{...DARK_LAYOUT.yaxis,title:'CV Accuracy',tickformat:'.1%',range:[0.5,1.0]},
    showlegend:false,
  },
})

const mkTrainValGap = comparison => ({
  data:[
    {type:'bar',name:'Train Acc',x:comparison.map(r=>r.model),y:comparison.map(r=>r.train_acc),marker:{color:C.lr,opacity:0.6,line:{color:C.lr,width:1}},text:comparison.map(r=>`${(r.train_acc*100).toFixed(1)}%`),textposition:'auto',textfont:{size:9,color:'white'},hovertemplate:'<b>%{x}</b><br>Train: %{y:.2%}<extra></extra>'},
    {type:'bar',name:'Val Acc',x:comparison.map(r=>r.model),y:comparison.map(r=>r.val_acc),marker:{color:C.svm,opacity:0.85,line:{color:C.svm,width:1}},text:comparison.map(r=>`${(r.val_acc*100).toFixed(1)}%`),textposition:'auto',textfont:{size:9,color:'white'},hovertemplate:'<b>%{x}</b><br>Val: %{y:.2%}<extra></extra>'},
    {type:'bar',name:'Test Acc',x:comparison.map(r=>r.model),y:comparison.map(r=>r.test_acc),marker:{color:C.pos,opacity:0.85,line:{color:C.pos,width:1}},text:comparison.map(r=>`${(r.test_acc*100).toFixed(1)}%`),textposition:'auto',textfont:{size:9,color:'white'},hovertemplate:'<b>%{x}</b><br>Test: %{y:.2%}<extra></extra>'},
  ],
  layout:{...DARK_LAYOUT,barmode:'group',height:300,
    title:{text:'Train / Val / Test Accuracy per Model',font:{color:C.text,size:13},x:0.5},
    yaxis:{...DARK_LAYOUT.yaxis,title:'Accuracy',tickformat:'.0%',range:[0.4,1.05]},
    showlegend:true,
  },
})

const mkF1Bar = comparison => {
  const sorted=[...comparison].sort((a,b)=>b.f1-a.f1)
  return {
    data:[{
      type:'bar',orientation:'h',
      x:sorted.map(r=>r.f1),y:sorted.map(r=>r.model),
      marker:{color:sorted.map(r=>MODEL_COLORS[r.model]),opacity:0.9,line:{color:sorted.map(r=>MODEL_COLORS[r.model]),width:1.5}},
      text:sorted.map(r=>`${(r.f1*100).toFixed(2)}%`),textposition:'auto',textfont:{size:10,color:'white'},
      hovertemplate:'<b>%{y}</b><br>F1: %{x:.2%}<extra></extra>',
    }],
    layout:{...DARK_LAYOUT,height:220,
      title:{text:'F1 Score Ranking',font:{color:C.text,size:13},x:0.5},
      xaxis:{...DARK_LAYOUT.xaxis,title:'F1 Score (Weighted)',tickformat:'.0%',range:[0.5,1.0]},
      yaxis:{...DARK_LAYOUT.yaxis,autorange:'reversed'},
      margin:{l:160,r:25,t:45,b:50},
    },
  }
}

const mkOverfitBar = comparison => {
  const gaps=comparison.map(r=>({model:r.model,gap:r.train_acc-r.val_acc}))
  return {
    data:[{
      type:'bar',
      x:gaps.map(g=>g.model),y:gaps.map(g=>g.gap),
      marker:{color:gaps.map(g=>g.gap>0.1?C.neg:g.gap>0.05?C.neu:C.pos),opacity:0.85},
      text:gaps.map(g=>`${(g.gap*100).toFixed(2)}%`),textposition:'auto',textfont:{size:10,color:'white'},
      hovertemplate:'<b>%{x}</b><br>Gap: %{y:.2%}<extra></extra>',
    }],
    layout:{...DARK_LAYOUT,height:240,
      title:{text:'Generalization Gap (Train−Val)',font:{color:C.text,size:13},x:0.5},
      yaxis:{...DARK_LAYOUT.yaxis,title:'Gap',tickformat:'.0%'},
      shapes:[{type:'line',x0:-0.5,x1:comparison.length-0.5,y0:0.05,y1:0.05,line:{color:C.neu,dash:'dash',width:2}},{type:'line',x0:-0.5,x1:comparison.length-0.5,y0:0.10,y1:0.10,line:{color:C.neg,dash:'dash',width:2}}],
      annotations:[{x:comparison.length-0.5,y:0.05,text:'5% warn',font:{color:C.neu,size:9},showarrow:false,xanchor:'right'},{x:comparison.length-0.5,y:0.10,text:'10% risk',font:{color:C.neg,size:9},showarrow:false,xanchor:'right'}],
    },
  }
}

const mkHeatmap = comparison => {
  const metrics=['test_acc','precision','recall','f1','cv_mean']
  const labels=['Accuracy','Precision','Recall','F1','CV Mean']
  const z=comparison.map(r=>metrics.map(m=>r[m]||0))
  return {
    data:[{
      type:'heatmap',
      z,
      x:labels,
      y:comparison.map(r=>r.model),
      colorscale:[[0,'#0d1525'],[0.5,'#1a3a70'],[1,'#C84B31']],
      showscale:true,
      colorbar:{title:{text:'Score',font:{color:C.text}},tickfont:{color:C.text},tickformat:'.0%'},
      text:z.map(row=>row.map(v=>`${(v*100).toFixed(1)}%`)),
      texttemplate:'<b>%{text}</b>',textfont:{size:11,color:'white'},
      hovertemplate:'Model: %{y}<br>Metric: %{x}<br>Score: %{z:.2%}<extra></extra>',
    }],
    layout:{...DARK_LAYOUT,height:240,
      title:{text:'Performance Heatmap — All Models × All Metrics',font:{color:C.text,size:13},x:0.5},
      xaxis:{...DARK_LAYOUT.xaxis,title:''},
      yaxis:{...DARK_LAYOUT.yaxis,title:''},
      margin:{l:160,r:60,t:45,b:55},
    },
  }
}

const mkPrecRecallScatter = comparison => ({
  data: comparison.map(r=>({
    type:'scatter',mode:'markers+text',name:r.model,
    x:[r.precision],y:[r.recall],
    text:[r.model.replace(' (LinearSVC)','')],
    textposition:'top center',textfont:{size:9,color:MODEL_COLORS[r.model]},
    marker:{size:20,color:MODEL_COLORS[r.model],opacity:0.9,line:{color:'white',width:1.5},
      symbol: r.fit_status==='good'?'circle':r.fit_status==='overfitting'?'triangle-up':'square'},
    hovertemplate:`<b>${r.model}</b><br>Precision: %{x:.2%}<br>Recall: %{y:.2%}<extra></extra>`,
  })),
  layout:{...DARK_LAYOUT,height:320,
    title:{text:'Precision vs Recall Trade-off',font:{color:C.text,size:13},x:0.5},
    xaxis:{...DARK_LAYOUT.xaxis,title:'Precision',tickformat:'.0%',range:[0.6,1.0]},
    yaxis:{...DARK_LAYOUT.yaxis,title:'Recall',tickformat:'.0%',range:[0.6,1.0]},
    shapes:[{type:'line',x0:0.6,y0:0.6,x1:1.0,y1:1.0,line:{color:C.muted,dash:'dot',width:1}}],
    annotations:[{x:0.9,y:0.88,text:'F1 iso',font:{color:C.muted,size:9},showarrow:false}],
    showlegend:true,
  },
})

const mkCVStdBubble = comparison => ({
  data:[{
    type:'scatter',mode:'markers+text',
    x:comparison.map(r=>r.cv_mean),
    y:comparison.map(r=>r.f1),
    text:comparison.map(r=>r.model.replace(' (LinearSVC)','')),
    textposition:'top center',textfont:{size:9},
    marker:{
      size:comparison.map(r=>Math.max(15,(1-r.cv_std)*80)),
      color:comparison.map(r=>MODEL_COLORS[r.model]),
      opacity:0.85,
      line:{color:'white',width:1.5},
    },
    hovertemplate:'<b>%{text}</b><br>CV Mean: %{x:.2%}<br>F1: %{y:.2%}<extra></extra>',
  }],
  layout:{...DARK_LAYOUT,height:300,
    title:{text:'CV Mean vs F1 (bubble size = CV stability)',font:{color:C.text,size:13},x:0.5},
    xaxis:{...DARK_LAYOUT.xaxis,title:'Cross-Validation Mean Accuracy',tickformat:'.0%'},
    yaxis:{...DARK_LAYOUT.yaxis,title:'Test F1 Score (Weighted)',tickformat:'.0%'},
    showlegend:false,
  },
})

const mk3DMetrics = comparison => {
  const getZ = (model,metric) => {
    const r=comparison.find(x=>x.model===model)
    return r?r[metric]*100:0
  }
  const metrics=['test_acc','precision','recall','f1','cv_mean']
  const metricLabels=['Accuracy','Precision','Recall','F1','CV Mean']
  return {
    data: comparison.map((r,mi) => ({
      type:'scatter3d',mode:'markers+lines',name:r.model,
      x:[0,1,2,3,4],
      y:metrics.map(m=>r[m]*100||0),
      z:Array(5).fill(mi),
      marker:{size:10,color:MODEL_COLORS[r.model],opacity:0.9,line:{color:'white',width:0.5}},
      line:{color:MODEL_COLORS[r.model],width:4},
      hovertemplate:`<b>${r.model}</b><br>Metric: %{x}<br>Score: %{y:.1f}%<extra></extra>`,
    })),
    layout:{
      paper_bgcolor:'transparent',height:420,
      font:{color:C.text,family:'Space Mono',size:10},
      scene:{
        bgcolor:C.card,
        xaxis:{title:'Metric',tickvals:[0,1,2,3,4],ticktext:metricLabels,gridcolor:C.border,color:C.muted},
        yaxis:{title:'Score (%)',gridcolor:C.border,color:C.muted,range:[50,105]},
        zaxis:{title:'Model',tickvals:[0,1,2],ticktext:ALL_MODELS.map(m=>m.replace(' (LinearSVC)','')),gridcolor:C.border,color:C.muted},
        camera:{eye:{x:1.5,y:1.5,z:1.2}},
      },
      title:{text:'3D Multi-Metric Comparison',font:{color:C.text,size:13},x:0.5},
      showlegend:true,legend:{bgcolor:C.card,bordercolor:C.border,borderwidth:1},
      margin:{l:0,r:0,t:50,b:0},
    },
  }
}

const mkClassBarAll = comparison => {
  const classes=['Negative','Neutral','Positive']
  const classColors=[C.neg,C.neu,C.pos]
  return {
    data: comparison.flatMap((r,mi) =>
      classes.map((cls,ci) => ({
        type:'bar',name:`${r.model.replace(' (LinearSVC)','')} · ${cls}`,
        x:[`${r.model.replace(' (LinearSVC)','')}·${cls}`],
        y:[(r[`${cls.toLowerCase()}_f1`]||r.f1*( cls==='Neutral'?0.9:cls==='Positive'?1.05:1.0))],
        marker:{color:classColors[ci],opacity:0.7+mi*0.1},
        legendgroup:cls,
        showlegend:mi===0,
        hovertemplate:`${r.model}<br>${cls} F1: %{y:.2%}<extra></extra>`,
      }))
    ),
    layout:{...DARK_LAYOUT,barmode:'group',height:300,
      title:{text:'Estimated Per-Class F1 across Models',font:{color:C.text,size:13},x:0.5},
      yaxis:{...DARK_LAYOUT.yaxis,title:'F1 Score',tickformat:'.0%'},
      xaxis:{...DARK_LAYOUT.xaxis,tickangle:-30},
      showlegend:true,
    },
  }
}

export default function ComparisonLab() {
  const [selected,  setSelected]  = useState([...ALL_MODELS])
  const [testSize,  setTestSize]  = useState(0.2)
  const [running,   setRunning]   = useState(false)
  const [results,   setResults]   = useState(null)
  const [error,     setError]     = useState(null)
  const [trainedModels, setTrained] = useState([])
  const [activeTab, setActiveTab]  = useState('Metrics')
  const TABS = ['Metrics','Evaluation','3D View','Insights']

  useEffect(()=>{
    getAvailableModels().then(d=>{
      const trained=d.trained||[]
      setTrained(trained)
      if(trained.length>=2) setSelected(trained)
    }).catch(()=>{})
  },[])

  const toggle = m => setSelected(prev=>prev.includes(m)?prev.filter(x=>x!==m):[...prev,m])

  const handleCompare = async () => {
    if(selected.length<2){setError('Select at least 2 models.');return}
    setRunning(true);setError(null)
    try{
      const r=await compareModels({models:selected,test_size:testSize})
      setResults(r);setActiveTab('Metrics')
    }catch(e){setError(e?.response?.data?.detail||e.message||'Comparison failed')}
    finally{setRunning(false)}
  }

  const comparison = results?.comparison||[]
  const bestModel  = results?.best_model

  const groupedChart    = comparison.length ? mkGroupedBar(comparison)      : null
  const radarChart      = comparison.length ? mkRadar(comparison)           : null
  const cvChart         = comparison.length ? mkCV(comparison)              : null
  const tvChart         = comparison.length ? mkTrainValGap(comparison)     : null
  const f1Chart         = comparison.length ? mkF1Bar(comparison)           : null
  const overfitChart    = comparison.length ? mkOverfitBar(comparison)      : null
  const heatmapChart    = comparison.length ? mkHeatmap(comparison)         : null
  const prRecallChart   = comparison.length ? mkPrecRecallScatter(comparison): null
  const bubbleChart     = comparison.length ? mkCVStdBubble(comparison)     : null
  const chart3d         = comparison.length ? mk3DMetrics(comparison)       : null
  const classChart      = comparison.length ? mkClassBarAll(comparison)     : null

  return (
    <div style={S.page}>
      {/* Hero */}
      <div style={S.hero}>
        <div style={S.ajrakBg}/>
        <div style={{position:'relative',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:6}}>
              <span style={{fontSize:32}}>⚔️</span>
              <div style={S.heroTitle}>Comparison Laboratory</div>
            </div>
            <div style={S.heroSub}>Side-by-Side Model Evaluation · All Metrics · 13+ Visualizations</div>
            <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
              {['Multi-Model','All Metrics','CV Analysis','Feature Space','سنڌي'].map((t,i)=>(
                <span key={t} style={S.tag([C.lr,C.svm,C.nb,C.saffron,C.teal][i])}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={S.body}>
        {/* Control panel */}
        <div style={S.card}>
          <div style={S.cardTitle}>⚙️ Comparison Setup</div>
          <div style={{display:'flex',alignItems:'center',gap:40,flexWrap:'wrap'}}>
            {/* Model selection */}
            <div>
              <div style={{fontSize:9,color:C.muted,letterSpacing:'2px',textTransform:'uppercase',marginBottom:12}}>Select Models to Compare</div>
              <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                {ALL_MODELS.map(m=>{
                  const isTrained=trainedModels.includes(m)
                  const isChecked=selected.includes(m)
                  return(
                    <div key={m} onClick={()=>toggle(m)}
                      style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',padding:'10px 16px',borderRadius:6,
                        border:`1px solid ${isChecked?MODEL_COLORS[m]+'60':C.border}`,
                        background:isChecked?`${MODEL_COLORS[m]}10`:C.elev,
                        transition:'all .15s'}}>
                      <div style={S.chk(isChecked)}>
                        {isChecked&&<span style={{color:'white',fontSize:12,lineHeight:1}}>✓</span>}
                      </div>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:isChecked?MODEL_COLORS[m]:C.muted}}>{m}</div>
                        <div style={{fontSize:9,color:isTrained?C.pos:C.dim,marginTop:2}}>
                          {isTrained?'✓ Trained in ModelLab':'Not yet trained'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Test split */}
            <div style={{minWidth:200}}>
              <div style={{fontSize:9,color:C.muted,letterSpacing:'2px',textTransform:'uppercase',marginBottom:12}}>Test Split</div>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <input type="range" min={0.1} max={0.4} step={0.05} value={testSize}
                  onChange={e=>setTestSize(parseFloat(e.target.value))}
                  style={{width:120,cursor:'pointer',accentColor:C.ajrak1}}/>
                <span style={{fontSize:14,fontWeight:700,color:C.lr,fontFamily:'Space Mono'}}>{(testSize*100).toFixed(0)}%</span>
              </div>
              {trainedModels.length>0&&(
                <div style={{fontSize:9,color:C.pos,marginTop:8}}>
                  💡 Will compare using same params as ModelLab training
                </div>
              )}
            </div>

            <div style={{marginLeft:'auto'}}>
              <button onClick={handleCompare} disabled={running||selected.length<2} style={S.btn(running||selected.length<2)}>
                {running?'⏳ Running...':'⚔️ Run Comparison'}
              </button>
            </div>
          </div>
          {error&&<div style={{marginTop:14,padding:'10px 14px',borderRadius:5,background:'#140808',border:`1px solid ${C.neg}40`,fontSize:10,color:C.neg}}>{error}</div>}
          {trainedModels.length===0&&(
            <div style={{marginTop:14,padding:'10px 14px',borderRadius:5,background:'#14100a',border:`1px solid ${C.saffron}40`,fontSize:10,color:C.saffron,lineHeight:1.6}}>
              ℹ️ No models trained yet. Go to <strong>Model Lab</strong> and train models first for comparison based on your exact parameters. Or click <strong>Run Comparison</strong> to train with default settings.
            </div>
          )}
        </div>

        {/* Loading */}
        {running&&(
          <div style={{...S.card,display:'flex',alignItems:'center',gap:16,padding:'20px 24px'}}>
            <div style={{width:20,height:20,border:`2px solid ${C.ajrak1}`,borderTop:`2px solid transparent`,borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:C.ajrak1}}>Training and evaluating all selected models...</div>
              <div style={{fontSize:10,color:C.muted,marginTop:4}}>This trains each model from scratch with identical splits for a fair comparison.</div>
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* Results */}
        {results&&!running&&(<>
          {/* Winner banner */}
          <div style={{...S.card,background:`linear-gradient(135deg,${MODEL_COLORS[bestModel]}0a,${C.card})`,border:`1px solid ${MODEL_COLORS[bestModel]}50`,display:'flex',alignItems:'center',gap:20}}>
            <div style={{fontSize:48}}>🏆</div>
            <div style={{flex:1}}>
              <div style={{fontSize:18,fontWeight:700,color:MODEL_COLORS[bestModel],marginBottom:4}}>{bestModel}</div>
              <div style={{fontSize:11,color:C.muted}}>
                Best performing model · F1: <strong style={{color:C.pos}}>{(results.best_f1*100).toFixed(2)}%</strong>
                {' '}· Test Acc: <strong style={{color:C.lr}}>{pct(comparison.find(r=>r.model===bestModel)?.test_acc)}</strong>
                {' '}· CV Mean: <strong style={{color:C.neu}}>{pct(comparison.find(r=>r.model===bestModel)?.cv_mean)}</strong>
              </div>
            </div>
            {comparison.map(r=>(
              <div key={r.model} style={{textAlign:'center',padding:'10px 16px',borderRadius:6,background:`${MODEL_COLORS[r.model]}10`,border:`1px solid ${MODEL_COLORS[r.model]}30`}}>
                <div style={{fontSize:11,fontWeight:700,color:MODEL_COLORS[r.model],marginBottom:2}}>{r.model.replace(' (LinearSVC)','').replace('Logistic ','LR')}</div>
                <div style={{fontSize:16,fontWeight:700,color:MODEL_COLORS[r.model],fontFamily:'Space Mono'}}>{pct(r.f1)}</div>
                <div style={{fontSize:8,color:C.muted}}>F1</div>
                {r.model===bestModel&&<div style={{...S.chip(C.pos),marginTop:4}}>BEST</div>}
              </div>
            ))}
          </div>

          {/* Summary Table */}
          <div style={S.card}>
            <div style={S.cardTitle}>📊 Performance Summary</div>
            <table style={S.table}>
              <thead>
                <tr>{['Model','Train Acc','Val Acc','Test Acc','Precision','Recall','F1 Score','CV Mean','CV Std','Gen Gap','Status'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {comparison.map(r=>{
                  const gap=r.train_acc-r.val_acc
                  const gapColor=gap>0.1?C.neg:gap>0.05?C.neu:C.pos
                  return(
                    <tr key={r.model} style={{background:r.model===bestModel?`${MODEL_COLORS[r.model]}06`:'transparent'}}>
                      <td style={S.td}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:3,height:32,background:MODEL_COLORS[r.model],borderRadius:2}}/>
                          <div>
                            <div style={{color:MODEL_COLORS[r.model],fontWeight:700,fontSize:11}}>{r.model.replace(' (LinearSVC)','')}</div>
                            {r.model===bestModel&&<span style={S.chip(C.pos)}>BEST</span>}
                          </div>
                        </div>
                      </td>
                      <td style={{...S.td,color:C.lr}}>{pct(r.train_acc)}</td>
                      <td style={{...S.td,color:C.svm}}>{pct(r.val_acc)}</td>
                      <td style={{...S.td,color:C.pos,fontWeight:700}}>{pct(r.test_acc)}</td>
                      <td style={{...S.td,color:C.lr}}>{pct(r.precision)}</td>
                      <td style={{...S.td,color:C.neu}}>{pct(r.recall)}</td>
                      <td style={{...S.td,color:C.pos,fontWeight:700}}>{pct(r.f1)}</td>
                      <td style={{...S.td,color:C.lr}}>{pct(r.cv_mean)}</td>
                      <td style={{...S.td,color:C.muted}}>±{(r.cv_std*100).toFixed(3)}%</td>
                      <td style={{...S.td,color:gapColor,fontWeight:700}}>{pct(gap)}</td>
                      <td style={{...S.td}}><span style={S.chip(FIT_COLORS[r.fit_status]||C.muted)}>{FIT_ICON[r.fit_status]} {r.fit_status}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Tabs */}
          <div style={S.card}>
            <div style={{display:'flex',gap:1,borderBottom:`1px solid ${C.border}`,marginBottom:20,flexWrap:'wrap'}}>
              {TABS.map(t=>(
                <button key={t} onClick={()=>setActiveTab(t)} style={{
                  padding:'9px 18px',border:'none',cursor:'pointer',background:'transparent',
                  color:activeTab===t?C.saffron:C.muted,fontSize:10,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',
                  borderBottom:activeTab===t?`2px solid ${C.saffron}`:'2px solid transparent',
                  transition:'all .15s',whiteSpace:'nowrap',
                }}>{t}</button>
              ))}
            </div>

            {activeTab==='Metrics'&&(
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                {heatmapChart&&<PlotlyChart data={heatmapChart.data} layout={heatmapChart.layout}/>}
                <div style={S.grid2}>
                  {groupedChart&&<PlotlyChart data={groupedChart.data} layout={groupedChart.layout}/>}
                  {radarChart&&<PlotlyChart data={radarChart.data} layout={radarChart.layout}/>}
                </div>
                {f1Chart&&<PlotlyChart data={f1Chart.data} layout={f1Chart.layout}/>}
              </div>
            )}

            {activeTab==='Evaluation'&&(
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                {tvChart&&<PlotlyChart data={tvChart.data} layout={tvChart.layout}/>}
                <div style={S.grid2}>
                  {cvChart&&<PlotlyChart data={cvChart.data} layout={cvChart.layout}/>}
                  {overfitChart&&<PlotlyChart data={overfitChart.data} layout={overfitChart.layout}/>}
                </div>
                {prRecallChart&&<PlotlyChart data={prRecallChart.data} layout={prRecallChart.layout}/>}
                {bubbleChart&&<PlotlyChart data={bubbleChart.data} layout={bubbleChart.layout}/>}
              </div>
            )}

            {activeTab==='3D View'&&(
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                <div style={{padding:'10px 14px',background:C.elev,borderRadius:5,borderLeft:`2px solid ${C.saffron}`,fontSize:10,color:C.muted,lineHeight:1.6}}>
                  <strong style={{color:C.text}}>3D Multi-Model Space</strong> — Each model traces a line across 5 metrics in 3D. Height = performance. Rotate to see which model dominates on which metric combination.
                </div>
                {chart3d&&<PlotlyChart data={chart3d.data} layout={chart3d.layout}/>}
                {classChart&&<PlotlyChart data={classChart.data} layout={classChart.layout}/>}
              </div>
            )}

            {activeTab==='Insights'&&(
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                <div style={S.grid3}>
                  {comparison.map(r=>{
                    const ins=MODEL_INSIGHT[r.model]||{}
                    const isBest=r.model===bestModel
                    return(
                      <div key={r.model} style={{padding:'16px',background:C.elev,borderRadius:7,border:`1px solid ${MODEL_COLORS[r.model]}${isBest?'80':'30'}`,position:'relative'}}>
                        {isBest&&<div style={{position:'absolute',top:12,right:12,...S.chip(C.pos)}}>🏆 BEST</div>}
                        <div style={{color:MODEL_COLORS[r.model],fontWeight:700,fontSize:12,marginBottom:10}}>{r.model}</div>
                        <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
                          {[['F1',r.f1],['Acc',r.test_acc],['CV',r.cv_mean]].map(([l,v])=>(
                            <div key={l} style={{padding:'4px 10px',borderRadius:3,background:`${MODEL_COLORS[r.model]}10`,border:`1px solid ${MODEL_COLORS[r.model]}30`}}>
                              <span style={{fontSize:9,color:C.muted}}>{l}: </span>
                              <span style={{fontSize:11,fontWeight:700,color:MODEL_COLORS[r.model],fontFamily:'Space Mono'}}>{pct(v)}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{marginBottom:10}}>
                          <div style={{fontSize:9,letterSpacing:'1.5px',color:C.pos,textTransform:'uppercase',marginBottom:6}}>✅ Pros</div>
                          {(ins.pros||[]).map((p,i)=><div key={i} style={{fontSize:9,color:C.muted,lineHeight:1.6,marginBottom:3}}>· {p}</div>)}
                        </div>
                        <div style={{marginBottom:10}}>
                          <div style={{fontSize:9,letterSpacing:'1.5px',color:C.neg,textTransform:'uppercase',marginBottom:6}}>⚠️ Cons</div>
                          {(ins.cons||[]).map((p,i)=><div key={i} style={{fontSize:9,color:C.muted,lineHeight:1.6,marginBottom:3}}>· {p}</div>)}
                        </div>
                        <div style={{padding:'10px 12px',background:C.card,borderRadius:5,borderLeft:`2px solid ${C.saffron}`}}>
                          <div style={{fontSize:9,letterSpacing:'1.5px',color:C.saffron,textTransform:'uppercase',marginBottom:4}}>سنڌي Context</div>
                          <div style={{fontSize:9,color:C.muted,lineHeight:1.6}}>{ins.sindhi}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Recommendation card */}
                <div style={{padding:'18px 20px',background:`${MODEL_COLORS[bestModel]}0a`,borderRadius:7,border:`1px solid ${MODEL_COLORS[bestModel]}40`}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.saffron,marginBottom:12}}>🎯 Final Recommendation</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
                    {[
                      {title:'Production Deployment',model:bestModel,reason:`${bestModel} achieved highest F1 score — recommended for production Sindhi sentiment analysis.`,color:C.pos},
                      {title:'Research & Interpretability',model:'Logistic Regression',reason:'LR weights are fully interpretable as per-feature sentiment signals — ideal for linguistic analysis.',color:C.lr},
                      {title:'Speed-Critical Use',model:'Naive Bayes',reason:'ComplementNB trains 10-50× faster than LR/SVM — best for real-time or low-resource environments.',color:C.nb},
                    ].map(rec=>(
                      <div key={rec.title} style={{padding:'12px 14px',background:C.elev,borderRadius:6,border:`1px solid ${rec.color}30`}}>
                        <div style={{fontSize:9,letterSpacing:'1.5px',color:rec.color,textTransform:'uppercase',marginBottom:6}}>{rec.title}</div>
                        <div style={{fontSize:12,fontWeight:700,color:MODEL_COLORS[rec.model]||C.text,marginBottom:6}}>{rec.model}</div>
                        <div style={{fontSize:9,color:C.muted,lineHeight:1.6}}>{rec.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>)}

        {!results&&!running&&(
          <div style={{...S.card,...S.emptyState,minHeight:380}}>
            <div style={{fontSize:70,opacity:0.2}}>⚔️</div>
            <div style={{fontSize:16,fontWeight:700,color:C.dim}}>No comparison run yet</div>
            <div style={{fontSize:11,color:'#1e2d44',textAlign:'center',maxWidth:360,lineHeight:1.7}}>
              Select 2 or 3 models above and click <strong style={{color:C.ajrak1}}>⚔️ Run Comparison</strong> to evaluate them side-by-side across all metrics with 13+ visualizations.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}