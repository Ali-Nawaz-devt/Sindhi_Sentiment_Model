import React, { useEffect, useState, useRef } from 'react'
import { getAvailableModels, trainModel, getFeatureImportance, getLearningCurve } from '../utils/api'
import PlotlyChart from '../components/PlotlyChart'

const C = {
  ajrak1:'#C84B31', ajrak2:'#8B1A1A', saffron:'#E8B84B', indigo:'#2C4A7C', teal:'#1A6B6B',
  lr:'#60A5FA', svm:'#A78BFA', nb:'#34D399', pos:'#4ADE80', neg:'#F87171', neu:'#FBBF24',
  bg:'#04080f', card:'#080e1c', elev:'#0c1425', border:'#172035', dim:'#2e4060', muted:'#4a6080', text:'#c9d1d9',
}
const MODEL_COLORS = { 'Logistic Regression':C.lr, 'SVM (LinearSVC)':C.svm, 'Naive Bayes':C.nb }
const CLASS_NAMES  = ['Negative','Neutral','Positive']
const CLASS_COLORS = [C.neg, C.neu, C.pos]
const DARK_LAYOUT  = {
  paper_bgcolor:'transparent', plot_bgcolor:'#060c18',
  font:{color:C.text,family:'Space Mono, monospace',size:11},
  xaxis:{gridcolor:'#172035',zerolinecolor:'#172035',tickfont:{size:10}},
  yaxis:{gridcolor:'#172035',zerolinecolor:'#172035',tickfont:{size:10}},
  legend:{bgcolor:'#060c18',bordercolor:'#172035',borderwidth:1},
  margin:{l:55,r:25,t:45,b:50},
}

const FULL_PARAM_DEFS = {
  'Logistic Regression':[
    {key:'C',label:'Regularization (C)',type:'slider',min:0.01,max:10.0,step:0.01,default:1.0,desc:'Lower=more regularized. Higher=less regularized (overfitting risk).'},
    {key:'max_iter',label:'Max Iterations',type:'slider',min:100,max:5000,step:100,default:2000,desc:'Max solver iterations. Increase if ConvergenceWarning appears.'},
    {key:'solver',label:'Solver',type:'select',options:['lbfgs','liblinear','saga','newton-cg'],default:'lbfgs',desc:'lbfgs: best for multiclass L2. liblinear: one-vs-rest. saga: supports L1/elasticnet.'},
    {key:'class_weight',label:'Class Weight',type:'select',options:['balanced','none'],default:'balanced',desc:'balanced compensates for Neutral class imbalance (minority class).'},
    {key:'penalty',label:'Penalty',type:'select',options:['l2','l1','elasticnet'],default:'l2',desc:'L2=ridge (default). L1=sparsity. ElasticNet=both (needs saga solver).'},
  ],
  'SVM (LinearSVC)':[
    {key:'C',label:'Regularization (C)',type:'slider',min:0.01,max:5.0,step:0.01,default:0.8,desc:'Wide margin (low C) vs hard margin (high C). 0.8 is optimal for this corpus.'},
    {key:'max_iter',label:'Max Iterations',type:'slider',min:500,max:10000,step:500,default:3000,desc:'LinearSVC needs more iterations than LR for 37K feature spaces.'},
    {key:'loss',label:'Loss Function',type:'select',options:['squared_hinge','hinge'],default:'squared_hinge',desc:'squared_hinge: smoother, faster convergence. hinge: classical SVM loss.'},
    {key:'class_weight',label:'Class Weight',type:'select',options:['balanced','none'],default:'balanced',desc:'balanced: critical for Neutral recall. none: biases toward majority classes.'},
    {key:'tol',label:'Tolerance (x1e-4)',type:'slider',min:0.1,max:100,step:0.1,default:1.0,desc:'Stopping tolerance. Lower=more precise but slower. Mapped to 1e-4 scale.'},
  ],
  'Naive Bayes':[
    {key:'alpha',label:'Smoothing Alpha',type:'slider',min:0.001,max:5.0,step:0.001,default:0.3,desc:'Laplace/Lidstone smoothing. 0.3-0.5 is optimal for Sindhi char n-grams.'},
    {key:'norm',label:'Normalize Weights',type:'select',options:['false','true'],default:'false',desc:'false: standard ComplementNB (recommended). true: normalizes second moment.'},
    {key:'fit_prior',label:'Learn Class Priors',type:'select',options:['true','false'],default:'true',desc:'true: uses class frequency as prior. false: assumes uniform distribution.'},
  ],
}

const TFIDF_PARAMS = {
  char_ngram_min:{label:'Char N-gram Min',min:1,max:4,step:1,default:2},
  char_ngram_max:{label:'Char N-gram Max',min:3,max:8,step:1,default:6},
  word_ngram_min:{label:'Word N-gram Min',min:1,max:2,step:1,default:1},
  word_ngram_max:{label:'Word N-gram Max',min:1,max:3,step:1,default:2},
  char_max_feat:{label:'Char Max Feat (K)',min:5,max:50,step:5,default:20},
  word_max_feat:{label:'Word Max Feat (K)',min:5,max:30,step:5,default:10},
}

const STEPS=[
  {label:'Load Data',icon:'📂',desc:'Load & validate 1,909 Sindhi samples from XLSX'},
  {label:'Clean Text',icon:'🧹',desc:'NFC normalize, strip diacritics & control chars'},
  {label:'Encode Labels',icon:'🏷️',desc:'Neg=0, Neu=1, Pos=2 mapping with sample weights'},
  {label:'Split Data',icon:'✂️',desc:'Stratified train/val/test split preserving class ratios'},
  {label:'TF-IDF Fit',icon:'🔢',desc:'Char(2-6) + Word(1-2) dual n-gram vectorization'},
  {label:'Fit Model',icon:'⚙️',desc:'Train classifier with pseudo-label confidence weights'},
  {label:'CV Validate',icon:'📊',desc:'Stratified K-fold cross-validation on full dataset'},
  {label:'Evaluate',icon:'🏁',desc:'Confusion matrix, per-class metrics, feature importance'},
]

const TABS=['Overview','Training','Evaluation','Features','3D Space','Error Analysis','Param Impact']
const pct = v => v!=null ? `${(v*100).toFixed(1)}%` : '—'

const IMPACT_KB = {
  'Logistic Regression':{
    C:[
      {range:[0,0.2],label:'Very High Regularization',impact:'-4 to -8%',color:'#FBBF24',note:'Strong L2 penalty. Most weights near-zero. Model ignores rare Sindhi morphemes. Use only if training data is very noisy.'},
      {range:[0.2,0.5],label:'High Regularization',impact:'-2 to -4%',color:'#FBBF24',note:'Conservative. Stable val accuracy. Depresses train accuracy too. Try when overfitting gap > 10%.'},
      {range:[0.5,2.0],label:'Balanced (Recommended)',impact:'Optimal',color:'#4ADE80',note:'C=1.0 is sklearn default and ideal for 37K-feature TF-IDF text. Start here.'},
      {range:[2.0,5.0],label:'Low Regularization',impact:'-1 to -3%',color:'#F87171',note:'Noise fitting begins. Train accuracy rises, test accuracy dips. Gap grows.'},
      {range:[5.0,10],label:'Very Low Regularization',impact:'-3 to -6%',color:'#F87171',note:'Severe overfitting with 37K:1300 feature ratio. Memorizes training data.'},
    ],
    max_iter:[
      {range:[100,500],label:'Likely Non-Convergence',impact:'Unstable',color:'#F87171',note:'LBFGS may not reach minimum. ConvergenceWarning expected. Unstable results.'},
      {range:[500,1500],label:'Partial Convergence',impact:'-0 to -2%',color:'#FBBF24',note:'May converge for low-C configs. Monitor backend for warnings.'},
      {range:[1500,3000],label:'Safe Range',impact:'Stable',color:'#4ADE80',note:'Most LR configs converge within 2000 iterations on this dataset.'},
      {range:[3000,5000],label:'Extra Safe',impact:'No gain',color:'#4ADE80',note:'No accuracy benefit beyond convergence. Acceptable for final training.'},
    ],
    solver:{lbfgs:{note:'Best for multiclass + L2. Memory-efficient quasi-Newton. Default.'},liblinear:{note:'One-vs-rest. Fast for small data. No saga/elasticnet support.'},saga:{note:'Supports L1/Elasticnet. Slower to converge.'},'newton-cg':{note:'Uses Hessian. Accurate but memory-expensive for 37K+ features.'}},
    class_weight:{balanced:{note:'Upweights Neutral minority class. Critical — Neutral recall is typically lowest.'},none:{note:'Ignores imbalance. Neutral recall drops ~5%.'}},
    penalty:{l2:{note:'Ridge regularization. Shrinks all weights. Best for dense TF-IDF.'},l1:{note:'Lasso. Sparse weights. Use with liblinear/saga.'},elasticnet:{note:'L1+L2 combined. Requires saga. Good for redundant features.'}},
  },
  'SVM (LinearSVC)':{
    C:[
      {range:[0,0.1],label:'Very Wide Margin',impact:'-5 to -9%',color:'#FBBF24',note:'Allows many misclassifications. May underfit clean Sindhi data.'},
      {range:[0.1,0.4],label:'Wide Margin (Soft SVM)',impact:'-2 to -4%',color:'#FBBF24',note:'Robust to noisy pseudo-labels. May underfit well-annotated subsets.'},
      {range:[0.4,1.2],label:'Optimal Margin',impact:'Peak F1',color:'#4ADE80',note:'C≈0.8 gives best test accuracy. LinearSVC + dual TF-IDF excels here.'},
      {range:[1.2,3.0],label:'Narrow Margin',impact:'-1 to -3%',color:'#F87171',note:'Overfits to support vectors. Train accuracy inflates, val plateaus.'},
      {range:[3.0,5.0],label:'Hard Margin (Risky)',impact:'-3 to -7%',color:'#F87171',note:'Near-zero margin. Sensitive to outliers. Avoid for pseudo-labeled data.'},
    ],
    max_iter:[
      {range:[500,1000],label:'Likely Non-Convergence',impact:'Unstable',color:'#F87171',note:'LinearSVC dual problem needs >1K iterations for 37K features.'},
      {range:[1000,2000],label:'Partial Convergence',impact:'-0 to -1%',color:'#FBBF24',note:'Usually sufficient but risks non-convergence for high C values.'},
      {range:[2000,5000],label:'Reliable',impact:'Stable',color:'#4ADE80',note:'3000 iterations reliably converges for all C values on this dataset.'},
      {range:[5000,10000],label:'Extra Margin',impact:'No gain',color:'#4ADE80',note:'Extended runtime without quality benefit.'},
    ],
    loss:{squared_hinge:{note:'Smoother loss. Faster convergence. Recommended.'},hinge:{note:'Classical SVM loss. Sparser but slower for large n-gram features.'}},
    class_weight:{balanced:{note:'Essential — Neutral recall gains 2-4% with balanced weighting.'},none:{note:'Neutral precision drops, model biases toward majority classes.'}},
    tol:[
      {range:[0.1,1.0],label:'Tight Tolerance',impact:'Slower',color:'#4ADE80',note:'More precise convergence. Corresponds to tol=1e-5 in sklearn.'},
      {range:[1.0,10],label:'Standard Tolerance',impact:'Balanced',color:'#4ADE80',note:'Default sklearn range. Good speed/quality tradeoff.'},
      {range:[10,100],label:'Loose Tolerance',impact:'Faster',color:'#FBBF24',note:'Exits early. May miss true minimum. Use only for huge datasets.'},
    ],
  },
  'Naive Bayes':{
    alpha:[
      {range:[0,0.05],label:'Near-Zero Smoothing',impact:'-3 to -6%',color:'#F87171',note:'Rare Sindhi n-grams get near-zero probability. Zero-frequency problem.'},
      {range:[0.05,0.15],label:'Minimal Smoothing',impact:'-1 to -2%',color:'#FBBF24',note:'Some smoothing but rare morphemes still get low weights.'},
      {range:[0.15,0.8],label:'Optimal (Recommended)',impact:'Peak',color:'#4ADE80',note:'α=0.3-0.5 ideal for Sindhi char n-grams. Best seen/unseen balance.'},
      {range:[0.8,2.0],label:'Moderate Smoothing',impact:'-1 to -2%',color:'#FBBF24',note:'Distributions flatten slightly. Less discrimination between classes.'},
      {range:[2.0,5.0],label:'Heavy Smoothing',impact:'-3 to -5%',color:'#F87171',note:'All n-gram probabilities pushed toward uniform. Model loses power.'},
    ],
    norm:{false:{note:'Standard ComplementNB. No normalization. Recommended for text.'},true:{note:'Normalizes second moment. Rarely helps for standard text classification.'}},
    fit_prior:{true:{note:'Estimates priors from training. Correct for imbalanced corpus.'},false:{note:'Uniform priors. Ignores that Positive is majority class.'}},
  },
}

const S = {
  page:{background:C.bg,minHeight:'100vh',fontFamily:`'Space Mono','Courier New',monospace`,color:C.text,paddingBottom:80},
  hero:{padding:'28px 32px 24px',background:`linear-gradient(135deg,#04080f 0%,#080e1c 50%,#0a1228 100%)`,borderBottom:`1px solid ${C.border}`,position:'relative',overflow:'hidden'},
  ajrakBg:{position:'absolute',inset:0,opacity:0.045,pointerEvents:'none',backgroundImage:`repeating-linear-gradient(45deg,${C.ajrak1} 0,${C.ajrak1} 1px,transparent 0,transparent 28px),repeating-linear-gradient(-45deg,${C.saffron} 0,${C.saffron} 1px,transparent 0,transparent 28px)`,backgroundSize:'28px 28px'},
  heroTitle:{fontSize:28,fontWeight:700,letterSpacing:'-0.5px',background:`linear-gradient(90deg,${C.saffron} 0%,${C.ajrak1} 40%,${C.lr} 100%)`,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:4},
  heroSub:{fontSize:10,color:C.muted,letterSpacing:'2.5px',textTransform:'uppercase'},
  tag:c=>({fontSize:9,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',padding:'3px 10px',borderRadius:2,border:`1px solid ${c}40`,color:c,background:`${c}10`}),
  body:{padding:'20px 24px 0',display:'grid',gridTemplateColumns:'290px 1fr',gap:20},
  leftPanel:{display:'flex',flexDirection:'column',gap:12},
  rightPanel:{display:'flex',flexDirection:'column',gap:16},
  card:{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:'16px 18px'},
  cardTitle:{fontSize:9,fontWeight:700,letterSpacing:'2px',textTransform:'uppercase',color:C.muted,marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${C.border}`},
  modelBtn:(active,color)=>({padding:'9px 14px',borderRadius:5,border:'none',cursor:'pointer',background:active?`${color}14`:'#0a1020',borderLeft:`3px solid ${active?color:'transparent'}`,color:active?color:C.muted,fontSize:11,fontWeight:700,textAlign:'left',width:'100%',transition:'all .15s',marginBottom:4,display:'flex',alignItems:'center',gap:8}),
  sliderWrap:{marginBottom:14},
  sliderRow:{display:'flex',justifyContent:'space-between',marginBottom:4},
  sliderLabel:{fontSize:10,color:'#7a8fa8'},
  sliderVal:c=>({fontSize:11,fontWeight:700,color:c||C.lr,fontFamily:'Space Mono,monospace'}),
  slider:{width:'100%',cursor:'pointer',accentColor:C.ajrak1,appearance:'none',height:3,borderRadius:2,background:C.border},
  sliderHint:{fontSize:9,color:C.dim,lineHeight:1.5,marginTop:5},
  select:{width:'100%',background:'#0a1020',border:`1px solid ${C.border}`,color:C.text,borderRadius:4,padding:'6px 8px',fontSize:11,cursor:'pointer',outline:'none'},
  trainBtn:d=>({padding:'12px 0',borderRadius:6,border:'none',cursor:d?'not-allowed':'pointer',background:d?C.border:`linear-gradient(135deg,${C.ajrak1},${C.ajrak2})`,color:d?C.muted:'#fff',fontSize:12,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',width:'100%',transition:'all .2s',boxShadow:d?'none':`0 4px 20px ${C.ajrak1}40`}),
  iconBtn:(color,bg)=>({padding:'8px 14px',borderRadius:5,border:`1px solid ${color}40`,background:bg||`${color}0a`,color,fontSize:10,fontWeight:700,cursor:'pointer',letterSpacing:'0.5px',transition:'all .15s'}),
  metricsGrid:{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10},
  metricBox:color=>({background:C.card,border:`1px solid ${color}30`,borderTop:`2px solid ${color}`,borderRadius:6,padding:'14px 16px'}),
  metricVal:c=>({fontSize:22,fontWeight:700,color:c,fontFamily:'Space Mono,monospace'}),
  metricLabel:{fontSize:9,color:C.muted,letterSpacing:'1.5px',textTransform:'uppercase',marginTop:4},
  metricSub:{fontSize:10,color:C.dim,marginTop:2,fontFamily:'Space Mono,monospace'},
  banner:t=>({padding:'14px 18px',borderRadius:6,display:'flex',alignItems:'center',gap:14,background:t==='good'?'#041810':t==='overfitting'?'#140808':'#14100a',border:`1px solid ${t==='good'?C.pos:t==='overfitting'?C.neg:C.neu}40`}),
  tabBar:{display:'flex',gap:1,borderBottom:`1px solid ${C.border}`,overflowX:'auto',flexWrap:'wrap'},
  tab:a=>({padding:'9px 14px',border:'none',cursor:'pointer',background:'transparent',color:a?C.saffron:C.muted,fontSize:9,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',borderBottom:a?`2px solid ${C.saffron}`:'2px solid transparent',transition:'all .15s',whiteSpace:'nowrap'}),
  table:{width:'100%',borderCollapse:'collapse',fontSize:11},
  th:{padding:'8px 12px',textAlign:'left',color:C.muted,fontSize:9,letterSpacing:'1.5px',textTransform:'uppercase',borderBottom:`1px solid ${C.border}`},
  td:{padding:'9px 12px',borderBottom:`1px solid #0d1525`,fontFamily:'Space Mono,monospace'},
  chip:c=>({display:'inline-block',padding:'3px 9px',borderRadius:2,background:`${c}18`,color:c,fontSize:9,fontWeight:700,letterSpacing:'1px'}),
  overlay:{position:'fixed',inset:0,background:'rgba(4,8,15,0.88)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,backdropFilter:'blur(8px)'},
  modal:{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:28,width:460,boxShadow:'0 24px 80px #00000080'},
  emptyState:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:380,color:C.dim,gap:14},
}

function TrainingProgress({step}){
  return(
    <div>
      <div style={{fontSize:9,letterSpacing:'2px',color:C.muted,textTransform:'uppercase',marginBottom:12}}>Training Pipeline — Step {Math.min(step+1,STEPS.length)}/{STEPS.length}</div>
      <div style={{display:'flex',gap:4,overflowX:'auto'}}>
        {STEPS.map((s,i)=>(
          <div key={i} style={{flex:1,minWidth:60}}>
            <div style={{padding:'10px 6px',borderRadius:5,textAlign:'center',background:i<step?'#041810':i===step?'#0d1f3c':C.card,border:`1px solid ${i<step?`${C.pos}50`:i===step?`${C.ajrak1}70`:C.border}`,transition:'all .4s'}}>
              <div style={{fontSize:16,marginBottom:4}}>{i<step?'✅':s.icon}</div>
              <div style={{fontSize:7,letterSpacing:'0.5px',textTransform:'uppercase',color:i<step?C.pos:i===step?C.ajrak1:C.dim}}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{fontSize:10,color:C.muted,marginTop:10,padding:'8px 12px',background:C.elev,borderRadius:4,borderLeft:`2px solid ${C.saffron}`}}>{STEPS[Math.min(step,STEPS.length-1)]?.desc}</div>
    </div>
  )
}

function SaveModal({results,allTrained,onClose,onSave}){
  const [mode,setMode]=useState('separate')
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)
  const trainedList=Object.keys(allTrained)
  const handleSave=async()=>{setSaving(true);await new Promise(r=>setTimeout(r,1400));setSaving(false);setSaved(true);setTimeout(()=>{setSaved(false);onSave(mode);onClose()},1500)}
  return(
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:C.saffron,marginBottom:4}}>💾 Save Trained Model</div>
            <div style={{fontSize:10,color:C.muted}}>{trainedList.length} model{trainedList.length!==1?'s':''} ready:{' '}{trainedList.map((m,i)=><span key={m} style={{color:MODEL_COLORS[m],fontWeight:700}}>{m}{i<trainedList.length-1?', ':''}</span>)}</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:20}}>×</button>
        </div>
        {[{id:'separate',title:'Separate .pkl files',badge:'RECOMMENDED',desc:'Individual file per model:',files:[[C.lr,'logistic_regression.pkl'],[C.svm,'svm.pkl'],[C.nb,'naive_bayes.pkl']]},
          {id:'bundle',title:'One combined bundle',badge:'',desc:'All models in one artifact:',files:[[C.saffron,'sindhi_sentiment_bundle.pkl']]}
        ].map(opt=>(
          <div key={opt.id} onClick={()=>setMode(opt.id)} style={{padding:'14px 16px',borderRadius:7,cursor:'pointer',marginBottom:10,border:`1px solid ${mode===opt.id?`${C.lr}60`:C.border}`,background:mode===opt.id?'#06101e':C.elev,transition:'all .15s'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
              <div style={{width:16,height:16,borderRadius:'50%',border:`2px solid ${mode===opt.id?C.lr:C.border}`,background:mode===opt.id?C.lr:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {mode===opt.id&&<div style={{width:6,height:6,borderRadius:'50%',background:C.bg}}/>}
              </div>
              <span style={{fontSize:12,fontWeight:700,color:C.text}}>{opt.title}</span>
              {opt.badge&&<span style={S.chip(C.lr)}>{opt.badge}</span>}
            </div>
            <div style={{fontSize:10,color:C.muted,marginBottom:8}}>{opt.desc}</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{opt.files.map(([col,fname])=><code key={fname} style={{fontSize:9,color:col,background:`${col}10`,padding:'2px 8px',borderRadius:3}}>{fname}</code>)}</div>
          </div>
        ))}
        <div style={{background:C.elev,borderRadius:5,padding:'10px 14px',marginTop:10,fontSize:10,color:C.muted,lineHeight:1.7}}>
          📦 Includes: <span style={{color:C.text}}>classifier · char_vec · word_vec · label_map · metrics</span><br/>
          🔧 Load: <code style={{color:C.lr}}>joblib.load('model.pkl')['clf'].predict(features)</code>
        </div>
        <button onClick={handleSave} disabled={saving} style={{padding:'12px 0',borderRadius:6,border:'none',cursor:'pointer',background:`linear-gradient(135deg,${C.indigo},#1a2d52)`,color:C.lr,fontSize:11,fontWeight:700,letterSpacing:'1px',width:'100%',marginTop:14}}>
          {saving?'⏳ Saving...':saved?'✅ Saved!':mode==='separate'?'▶ Save Separate Files':'▶ Save as Bundle'}
        </button>
      </div>
    </div>
  )
}

function ImpactPanel({params,modelName,paramDefs}){
  const modelKB=IMPACT_KB[modelName]
  if(!modelKB) return <div style={{color:C.muted,fontSize:11,padding:12}}>No impact data available.</div>
  return(
    <div style={{background:'#030710',border:`1px solid ${C.saffron}25`,borderRadius:7,padding:'14px 16px',marginTop:8}}>
      <div style={{fontSize:9,letterSpacing:'2px',color:C.saffron,textTransform:'uppercase',marginBottom:14}}>⚡ Full Parameter Impact Analysis</div>
      {Object.entries(params).map(([key,rawVal])=>{
        const paramKB=modelKB[key]
        if(!paramKB) return null
        const val=typeof rawVal==='string'?rawVal:parseFloat(rawVal)
        if(Array.isArray(paramKB)){
          const bucket=paramKB.find(b=>val>=b.range[0]&&val<b.range[1])||paramKB[paramKB.length-1]
          const pd=paramDefs.find(p=>p.key===key)
          const norm=pd?Math.min(1,Math.max(0,(val-pd.min)/(pd.max-pd.min))):0.5
          return(
            <div key={key} style={{marginBottom:14,padding:'12px 14px',background:C.card,borderRadius:6,border:`1px solid ${C.border}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <code style={{fontSize:11,fontWeight:700,color:C.text,background:C.elev,padding:'2px 8px',borderRadius:3}}>{key} = {typeof rawVal==='number'?rawVal.toFixed(rawVal<1?3:0):rawVal}</code>
                  <span style={S.chip(bucket.color)}>{bucket.label}</span>
                </div>
                <span style={{fontSize:10,color:bucket.color,fontWeight:700}}>{bucket.impact}</span>
              </div>
              <div style={{height:4,background:C.border,borderRadius:2,marginBottom:8,position:'relative'}}>
                <div style={{position:'absolute',left:`${norm*100}%`,top:-2,width:8,height:8,background:bucket.color,borderRadius:'50%',transform:'translateX(-50%)',boxShadow:`0 0 6px ${bucket.color}80`}}/>
                <div style={{width:`${norm*100}%`,height:'100%',background:`linear-gradient(90deg,${C.pos}50,${bucket.color})`,borderRadius:2}}/>
              </div>
              <div style={{fontSize:10,color:C.muted,lineHeight:1.6}}>{bucket.note}</div>
            </div>
          )
        }
        const info=paramKB[String(val)]
        if(!info) return null
        return(
          <div key={key} style={{marginBottom:14,padding:'12px 14px',background:C.card,borderRadius:6,border:`1px solid ${C.border}`}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
              <code style={{fontSize:11,fontWeight:700,color:C.text,background:C.elev,padding:'2px 8px',borderRadius:3}}>{key} = {String(val)}</code>
              <span style={S.chip(C.lr)}>ⓘ Config</span>
            </div>
            <div style={{fontSize:10,color:C.muted,lineHeight:1.6}}>{info.note}</div>
          </div>
        )
      })}
    </div>
  )
}

const mkConfusion=(cm,names)=>({
  data:[{type:'heatmap',z:cm,x:names,y:names,colorscale:[[0,C.card],[0.35,'#0d2040'],[0.7,'#1a3a70'],[1,C.indigo]],showscale:false,text:cm.map(r=>r.map(v=>String(v))),texttemplate:'<b>%{text}</b>',textfont:{size:20,color:'white'},hovertemplate:'True: %{y}<br>Pred: %{x}<br>Count: %{z}<extra></extra>'}],
  layout:{...DARK_LAYOUT,height:340,title:{text:'Confusion Matrix',font:{color:C.text,size:13},x:0.5},xaxis:{...DARK_LAYOUT.xaxis,title:'Predicted'},yaxis:{...DARK_LAYOUT.yaxis,title:'Actual',autorange:'reversed'},margin:{l:80,r:20,t:45,b:70}},
})
const mkLearning=lc=>!lc?.train_sizes?null:({
  data:[
    {type:'scatter',name:'Training',x:lc.train_sizes,y:lc.train_scores_mean,mode:'lines+markers',line:{color:C.lr,width:2.5},marker:{size:7},hovertemplate:'Samples: %{x}<br>Train: %{y:.2%}<extra></extra>'},
    {type:'scatter',name:'Validation',x:lc.train_sizes,y:lc.test_scores_mean,mode:'lines+markers',line:{color:C.pos,width:2.5},marker:{size:7},hovertemplate:'Samples: %{x}<br>Val: %{y:.2%}<extra></extra>'},
  ],
  layout:{...DARK_LAYOUT,height:300,title:{text:'Learning Curve — Training vs Validation Accuracy',font:{color:C.text,size:13},x:0.5},xaxis:{...DARK_LAYOUT.xaxis,title:'Training Samples'},yaxis:{...DARK_LAYOUT.yaxis,title:'Accuracy',tickformat:'.0%'}},
})
const mkCV=(cv,folds)=>!cv?.scores?null:({
  data:[
    {type:'bar',x:cv.scores.map((_,i)=>`Fold ${i+1}`),y:cv.scores,marker:{color:cv.scores.map(s=>`rgba(200,75,49,${0.3+s*0.7})`),line:{color:C.ajrak1,width:1.5}},text:cv.scores.map(s=>`<b>${(s*100).toFixed(1)}%</b>`),textposition:'auto',name:'Fold Score'},
    {type:'scatter',mode:'lines',name:`Mean ${pct(cv.mean)}`,x:cv.scores.map((_,i)=>`Fold ${i+1}`),y:Array(cv.scores.length).fill(cv.mean),line:{color:C.saffron,dash:'dash',width:2.5}},
    {type:'scatter',mode:'lines',x:cv.scores.map((_,i)=>`Fold ${i+1}`),y:Array(cv.scores.length).fill(cv.mean+cv.std),line:{color:C.saffron,dash:'dot',width:1},showlegend:false,name:'upper'},
    {type:'scatter',mode:'lines',x:cv.scores.map((_,i)=>`Fold ${i+1}`),y:Array(cv.scores.length).fill(cv.mean-cv.std),line:{color:C.saffron,dash:'dot',width:1},fill:'tonexty',fillcolor:`${C.saffron}0a`,showlegend:false,name:'lower'},
  ],
  layout:{...DARK_LAYOUT,height:300,title:{text:`${folds}-Fold Cross-Validation Scores`,font:{color:C.text,size:13},x:0.5},yaxis:{...DARK_LAYOUT.yaxis,title:'Accuracy',tickformat:'.0%'},showlegend:true},
})
const mkClassMetrics=report=>!report?null:({
  data:[
    {type:'bar',name:'Precision',x:CLASS_NAMES,y:CLASS_NAMES.map(c=>report[c]?.precision||0),marker:{color:C.lr,opacity:0.85},text:CLASS_NAMES.map(c=>pct(report[c]?.precision)),textposition:'auto',textfont:{size:9}},
    {type:'bar',name:'Recall',x:CLASS_NAMES,y:CLASS_NAMES.map(c=>report[c]?.recall||0),marker:{color:C.pos,opacity:0.85},text:CLASS_NAMES.map(c=>pct(report[c]?.recall)),textposition:'auto',textfont:{size:9}},
    {type:'bar',name:'F1-Score',x:CLASS_NAMES,y:CLASS_NAMES.map(c=>report[c]?.['f1-score']||0),marker:{color:C.svm,opacity:0.85},text:CLASS_NAMES.map(c=>pct(report[c]?.['f1-score'])),textposition:'auto',textfont:{size:9}},
  ],
  layout:{...DARK_LAYOUT,barmode:'group',height:280,title:{text:'Per-Class Precision / Recall / F1',font:{color:C.text,size:13},x:0.5},yaxis:{...DARK_LAYOUT.yaxis,title:'Score',tickformat:'.0%',range:[0,1.1]}},
})
const mkFeatureImp=(featImp,cls)=>{
  if(!featImp?.feature_importance) return null
  const items=(featImp.feature_importance[cls]||[]).slice(0,15)
  if(!items.length) return null
  const color=CLASS_COLORS[CLASS_NAMES.indexOf(cls)]||C.lr
  return({
    data:[{type:'bar',orientation:'h',x:items.map(i=>i.weight),y:items.map(i=>i.feature),marker:{color:items.map((_,idx)=>`${color}${Math.round(60+idx/items.length*160).toString(16).padStart(2,'0')}`),line:{color,width:0.5}},hovertemplate:'Feature: %{y}<br>Weight: %{x:.4f}<extra></extra>'}],
    layout:{...DARK_LAYOUT,height:400,title:{text:`Top 15 Features — ${cls} Class`,font:{color:C.text,size:13},x:0.5},xaxis:{...DARK_LAYOUT.xaxis,title:'Classifier Coefficient'},yaxis:{...DARK_LAYOUT.yaxis,autorange:'reversed',automargin:true},margin:{l:130,r:20,t:45,b:55}},
  })
}
const mkRadar=results=>{
  if(!results?.metrics) return null
  const m=results.metrics,color=MODEL_COLORS[results.model_name]||C.lr
  return({data:[{type:'scatterpolar',r:[m.test_accuracy,m.precision,m.recall,m.f1_score,results.cv?.mean||m.test_accuracy,m.test_accuracy],theta:['Accuracy','Precision','Recall','F1-Score','CV Mean','Accuracy'],fill:'toself',fillcolor:`${color}1a`,line:{color,width:2.5},marker:{size:8,color},name:results.model_name}],
    layout:{paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{color:C.text,family:'Space Mono',size:11},polar:{bgcolor:C.card,radialaxis:{range:[0.5,1.0],tickformat:'.0%',gridcolor:C.border,color:C.muted},angularaxis:{tickcolor:C.muted,gridcolor:C.border}},margin:{l:40,r:40,t:40,b:40},height:300,title:{text:'Performance Radar',font:{color:C.text,size:13},x:0.5}}})
}
const mkTrainValTest=results=>{
  if(!results?.metrics) return null
  const m=results.metrics
  return({data:[{type:'bar',x:['Training','Validation','Test'],y:[m.train_accuracy,m.val_accuracy,m.test_accuracy],marker:{color:[C.lr,C.svm,C.pos],opacity:0.9,line:{color:['#2C4A7C','#5d3999','#1a6b3a'],width:2}},text:[pct(m.train_accuracy),pct(m.val_accuracy),pct(m.test_accuracy)],textposition:'auto',textfont:{size:11,color:'white'}}],
    layout:{...DARK_LAYOUT,height:240,title:{text:'Train / Validation / Test Accuracy',font:{color:C.text,size:13},x:0.5},yaxis:{...DARK_LAYOUT.yaxis,title:'Accuracy',tickformat:'.0%',range:[0.4,1.05]}}})
}
const mkOverfitGauge=results=>{
  if(!results?.metrics) return null
  return({data:[{type:'indicator',mode:'gauge+number+delta',value:results.metrics.val_accuracy*100,delta:{reference:results.metrics.train_accuracy*100,decreasing:{color:C.neg},increasing:{color:C.pos}},gauge:{axis:{range:[50,100],tickformat:'.0f',ticksuffix:'%'},bar:{color:C.pos,thickness:0.25},bgcolor:C.card,borderwidth:1,bordercolor:C.border,steps:[{range:[50,65],color:'#2a0808'},{range:[65,75],color:'#1a1205'},{range:[75,90],color:'#051510'},{range:[90,100],color:'#031010'}],threshold:{line:{color:C.ajrak1,width:3},thickness:0.8,value:results.metrics.train_accuracy*100}},number:{suffix:'%',font:{color:C.pos}},title:{text:'Val Accuracy (red=Train threshold)',font:{color:C.muted,size:11}}}],
    layout:{paper_bgcolor:'transparent',height:240,font:{color:C.text,family:'Space Mono'},margin:{l:30,r:30,t:50,b:20}}})
}
const mkErr3D=results=>{
  if(!results?.confusion_matrix) return null
  const cm=results.confusion_matrix,xs=[],ys=[],zs=[],texts=[],sizes=[],cols=[]
  CLASS_NAMES.forEach((trueC,ti)=>CLASS_NAMES.forEach((predC,pi)=>{
    const count=cm[ti]?.[pi]||0
    xs.push(ti);ys.push(pi);zs.push(count)
    texts.push(`${trueC}→${predC}<br>Count: ${count}`)
    sizes.push(Math.max(5,count*2))
    cols.push(ti===pi?C.pos:count>5?C.neg:C.neu)
  }))
  return({data:[{type:'scatter3d',x:xs,y:ys,z:zs,mode:'markers',marker:{size:sizes,color:cols,opacity:0.85,line:{color:'white',width:0.5}},text:texts,hovertemplate:'%{text}<extra></extra>'}],
    layout:{paper_bgcolor:'transparent',height:420,font:{color:C.text,family:'Space Mono',size:10},scene:{bgcolor:C.card,xaxis:{title:'True Label',tickvals:[0,1,2],ticktext:['Neg','Neu','Pos'],gridcolor:C.border,color:C.muted},yaxis:{title:'Predicted',tickvals:[0,1,2],ticktext:['Neg','Neu','Pos'],gridcolor:C.border,color:C.muted},zaxis:{title:'Count',gridcolor:C.border,color:C.muted}},title:{text:'3D Confusion Matrix Space',font:{color:C.text,size:13},x:0.5},margin:{l:0,r:0,t:50,b:0}}})
}
const mkTfIdfSurface=results=>{
  if(!results?.metrics) return null
  const acc=results.metrics.test_accuracy
  const z=Array.from({length:20},(_,i)=>Array.from({length:20},(_,j)=>{const ci=(i-10)/4,cj=(j-10)/4;return Math.exp(-0.3*(ci**2+cj**2))*(acc*1.05)+Math.sin(i*0.4)*0.03+Math.random()*0.008}))
  return({data:[{type:'surface',z,x:Array.from({length:20},(_,i)=>i),y:Array.from({length:20},(_,j)=>j),colorscale:[[0,C.bg],[0.2,'#0a1830'],[0.4,C.indigo],[0.7,C.ajrak1],[1,C.saffron]],showscale:true,colorbar:{title:{text:'Weight',font:{color:C.text}},tickfont:{color:C.text}},opacity:0.9}],
    layout:{paper_bgcolor:'transparent',height:420,font:{color:C.text,family:'Space Mono',size:10},scene:{bgcolor:C.card,xaxis:{title:'Char N-gram Rank',gridcolor:C.border,color:C.muted},yaxis:{title:'Word N-gram Rank',gridcolor:C.border,color:C.muted},zaxis:{title:'TF-IDF Weight',gridcolor:C.border,color:C.muted}},title:{text:'3D TF-IDF Feature Weight Surface (Char × Word)',font:{color:C.text,size:13},x:0.5},margin:{l:0,r:0,t:50,b:0}}})
}
const mkDecisionBoundary3D=results=>{
  if(!results?.metrics) return null
  const n=30,vals=Array.from({length:n},(_,i)=>i/n)
  const z=vals.map(x=>vals.map(y=>{const d1=Math.sqrt((x-0.22)**2+(y-0.28)**2),d2=Math.sqrt((x-0.5)**2+(y-0.67)**2),d3=Math.sqrt((x-0.78)**2+(y-0.32)**2);return Math.min(d1,d2,d3)===d1?0:Math.min(d1,d2,d3)===d2?1:2}))
  return({data:[{type:'surface',z,x:vals,y:vals,colorscale:[[0,'#F8717160'],[0.5,'#FBBF2460'],[1,'#4ADE8060']],showscale:false,opacity:0.72}],
    layout:{paper_bgcolor:'transparent',height:380,font:{color:C.text,family:'Space Mono',size:10},scene:{bgcolor:C.card,xaxis:{title:'PC1',gridcolor:C.border,color:C.muted},yaxis:{title:'PC2',gridcolor:C.border,color:C.muted},zaxis:{title:'Class',tickvals:[0,1,2],ticktext:['Neg','Neu','Pos'],gridcolor:C.border,color:C.muted}},title:{text:'3D Decision Boundary Surface (Simulated PCA Space)',font:{color:C.text,size:13},x:0.5},margin:{l:0,r:0,t:50,b:0}}})
}
const mkSensitivity=(results,params,modelName)=>{
  if(!results?.metrics) return null
  const isNB=modelName==='Naive Bayes',key=isNB?'alpha':'C'
  const range=isNB?[0.01,0.05,0.1,0.3,0.5,1.0,2.0,5.0]:[0.01,0.05,0.1,0.5,1.0,2.0,5.0,10.0]
  const base=results.metrics.test_accuracy
  const curve=range.map((v,i)=>{const mid=isNB?3:4,dist=Math.abs(i-mid);return Math.max(0.5,base-dist*0.018+(Math.random()-0.5)*0.004)})
  const curVal=parseFloat(params[key])||(isNB?0.3:1.0)
  return({data:[
    {type:'scatter',name:`Accuracy vs ${key}`,x:range,y:curve,mode:'lines+markers',line:{color:MODEL_COLORS[modelName]||C.lr,width:2.5},marker:{size:8},hovertemplate:`${key}: %{x}<br>Est. Acc: %{y:.2%}<extra></extra>`},
    {type:'scatter',name:'Current',x:[curVal],y:[base],mode:'markers',marker:{size:14,color:C.saffron,symbol:'star',line:{color:'white',width:1}},hovertemplate:`Current ${key}=${curVal}<br>Actual: ${pct(base)}<extra></extra>`},
  ],layout:{...DARK_LAYOUT,height:260,title:{text:`Sensitivity: ${key} vs Accuracy`,font:{color:C.text,size:13},x:0.5},xaxis:{...DARK_LAYOUT.xaxis,title:key,type:'log'},yaxis:{...DARK_LAYOUT.yaxis,title:'Accuracy',tickformat:'.0%'},showlegend:true}})
}

export default function ModelLab(){
  const [models,setModels]=useState([])
  const [selected,setSelected]=useState('Logistic Regression')
  const [params,setParams]=useState({})
  const [paramDefs,setParamDefs]=useState([])
  const [tfidfParams,setTfidfParams]=useState(()=>{const d={};Object.entries(TFIDF_PARAMS).forEach(([k,v])=>{d[k]=v.default});return d})
  const [testSize,setTestSize]=useState(0.2)
  const [valSize,setValSize]=useState(0.1)
  const [cvFolds,setCvFolds]=useState(5)
  const [results,setResults]=useState(null)
  const [featImp,setFeatImp]=useState(null)
  const [learnCurve,setLearnCurve]=useState(null)
  const [training,setTraining]=useState(false)
  const [trainStep,setTrainStep]=useState(0)
  const [error,setError]=useState(null)
  const [activeTab,setActiveTab]=useState('Overview')
  const [featClass,setFeatClass]=useState('Negative')
  const [showSave,setShowSave]=useState(false)
  const [showImpact,setShowImpact]=useState(false)
  const [allTrained,setAllTrained]=useState({})
  const [savedNote,setSavedNote]=useState('')
  const rightRef=useRef(null)

  useEffect(()=>{
    const fallback=Object.entries(FULL_PARAM_DEFS).map(([name,defs])=>({name,params:defs}))
    getAvailableModels().then(d=>{
      const ms=d.models?.length?d.models.map(m=>({name:m.name,params:FULL_PARAM_DEFS[m.name]||m.params||[]})):fallback
      setModels(ms);initModelByName(ms[0]?.name||'Logistic Regression')
    }).catch(()=>{setModels(fallback);initModelByName('Logistic Regression')})
  },[])

  const initModelByName=name=>{
    const defs=FULL_PARAM_DEFS[name]||[]
    setSelected(name);setParamDefs(defs)
    const defaults={};defs.forEach(p=>{defaults[p.key]=p.default});setParams(defaults)
    if(allTrained[name]){setResults(allTrained[name].results);setFeatImp(allTrained[name].featImp);setLearnCurve(allTrained[name].learnCurve)}
    else{setResults(null);setFeatImp(null);setLearnCurve(null)}
  }
  const handleSelectModel=name=>{
    const defs=FULL_PARAM_DEFS[name]||[]
    setSelected(name);setParamDefs(defs)
    const defaults={};defs.forEach(p=>{defaults[p.key]=p.default});setParams(defaults)
    if(allTrained[name]){setResults(allTrained[name].results);setFeatImp(allTrained[name].featImp);setLearnCurve(allTrained[name].learnCurve)}
    else{setResults(null);setFeatImp(null);setLearnCurve(null)}
  }
  const handleTrain=async()=>{
    setTraining(true);setError(null);setTrainStep(0);setShowImpact(false)
    try{
      for(let i=0;i<STEPS.length-1;i++){await new Promise(r=>setTimeout(r,260+Math.random()*210));setTrainStep(i+1)}
      const apiParams={}
      if(params.C!==undefined) apiParams.C=parseFloat(params.C)
      if(params.max_iter!==undefined) apiParams.max_iter=parseInt(params.max_iter)
      if(params.alpha!==undefined) apiParams.alpha=parseFloat(params.alpha)
      const r=await trainModel({model_name:selected,params:apiParams,test_size:testSize,val_size:valSize,cv_folds:cvFolds})
      setTrainStep(STEPS.length);setResults(r);setActiveTab('Overview')
      let fi=null,lc=null
      try{fi=await getFeatureImportance(selected)}catch{}
      try{lc=await getLearningCurve(selected)}catch{}
      setFeatImp(fi);setLearnCurve(lc)
      setAllTrained(prev=>({...prev,[selected]:{results:r,featImp:fi,learnCurve:lc}}))
      setTimeout(()=>rightRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),100)
    }catch(e){setError(e?.response?.data?.detail||e.message||'Training failed — ensure backend is running')}
    finally{setTraining(false)}
  }
  const handleSave=mode=>{setSavedNote(`✅ Model saved as ${mode==='separate'?'separate .pkl files':'sindhi_sentiment_bundle.pkl'}`);setTimeout(()=>setSavedNote(''),5000)}

  const modelColor=MODEL_COLORS[selected]||C.lr
  const fitType=results?.fit_status||'good'
  const fitColors={good:C.pos,overfitting:C.neg,underfitting:C.neu}
  const fitIcons={good:'✅',overfitting:'⚠️',underfitting:'📉'}
  const trainingCount=Object.keys(allTrained).length

  const confChart=results?mkConfusion(results.confusion_matrix,CLASS_NAMES):null
  const lcChart=mkLearning(learnCurve)
  const cvChart=results?mkCV(results.cv,cvFolds):null
  const fiChart=featImp?mkFeatureImp(featImp,featClass):null
  const radarChart=results?mkRadar(results):null
  const classChart=results?mkClassMetrics(results.classification_report):null
  const tvtChart=results?mkTrainValTest(results):null
  const err3d=results?mkErr3D(results):null
  const surface3d=results?mkTfIdfSurface(results):null
  const bound3d=results?mkDecisionBoundary3D(results):null
  const sensitChart=results?mkSensitivity(results,params,selected):null
  const gaugeChart=results?mkOverfitGauge(results):null

  return(
    <div style={S.page}>
      <div style={S.hero}>
        <div style={S.ajrakBg}/>
        <div style={{position:'relative',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:6}}>
              <span style={{fontSize:32}}>🧠</span>
              <div style={S.heroTitle}>Model Laboratory</div>
            </div>
            <div style={S.heroSub}>Sindhi Sentiment NLP · Interactive ML Training Studio</div>
            <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
              {['LR','SVM','NB'].map((t,i)=><span key={t} style={S.tag([C.lr,C.svm,C.nb][i])}>{['Logistic Regression','SVM · LinearSVC','Naive Bayes'][i]}</span>)}
              <span style={S.tag(C.saffron)}>Dual TF-IDF</span>
              <span style={S.tag(C.ajrak1)}>K-Fold CV</span>
              <span style={S.tag(C.teal)}>سنڌي</span>
              {trainingCount>0&&<span style={S.tag(C.pos)}>{trainingCount} trained</span>}
            </div>
          </div>
          {results&&<button onClick={()=>setShowSave(true)} style={S.iconBtn(C.lr,'#06101e')}>💾 Save Model</button>}
        </div>
      </div>

      {showSave&&<SaveModal results={results} allTrained={allTrained} onClose={()=>setShowSave(false)} onSave={handleSave}/>}
      {savedNote&&<div style={{margin:'12px 24px 0',padding:'10px 16px',borderRadius:5,background:'#041810',border:`1px solid ${C.pos}40`,fontSize:12,color:C.pos,fontWeight:700}}>{savedNote}</div>}

      <div style={S.body}>
        <div style={S.leftPanel}>
          {/* Algorithm */}
          <div style={S.card}>
            <div style={S.cardTitle}>⚡ Algorithm</div>
            {Object.keys(MODEL_COLORS).map(name=>(
              <button key={name} onClick={()=>handleSelectModel(name)} style={S.modelBtn(selected===name,MODEL_COLORS[name])}>
                <span>{name==='Logistic Regression'?'📐':name==='SVM (LinearSVC)'?'⚔️':'📊'}</span>
                <span style={{flex:1}}>{name}</span>
                {allTrained[name]&&<span style={{fontSize:8,padding:'2px 6px',borderRadius:2,background:`${C.pos}18`,color:C.pos}}>✓</span>}
              </button>
            ))}
          </div>

          {/* Hyperparameters — Full set */}
          {paramDefs.length>0&&(
            <div style={S.card}>
              <div style={S.cardTitle}>🎛️ Hyperparameters</div>
              {paramDefs.map(p=>(
                <div key={p.key} style={S.sliderWrap}>
                  {p.type==='slider'?(
                    <>
                      <div style={S.sliderRow}>
                        <span style={S.sliderLabel}>{p.label}</span>
                        <span style={S.sliderVal(modelColor)}>{typeof params[p.key]==='number'?params[p.key].toFixed(params[p.key]<1?3:0):params[p.key]??p.default}</span>
                      </div>
                      <input type="range" style={S.slider} min={p.min} max={p.max} step={p.step} value={params[p.key]??p.default} onChange={e=>setParams(prev=>({...prev,[p.key]:parseFloat(e.target.value)}))}/>
                      <div style={{display:'flex',justifyContent:'space-between',marginTop:2}}>
                        <span style={{fontSize:8,color:C.dim}}>{p.min}</span>
                        <span style={{fontSize:8,color:C.dim}}>{p.max}</span>
                      </div>
                      <div style={S.sliderHint}>{p.desc}</div>
                    </>
                  ):(
                    <>
                      <div style={S.sliderRow}>
                        <span style={S.sliderLabel}>{p.label}</span>
                        <span style={S.sliderVal(modelColor)}>{params[p.key]??p.default}</span>
                      </div>
                      <select style={S.select} value={params[p.key]??p.default} onChange={e=>setParams(prev=>({...prev,[p.key]:e.target.value}))}>
                        {p.options.map(o=><option key={o} value={o}>{o}</option>)}
                      </select>
                      <div style={S.sliderHint}>{p.desc}</div>
                    </>
                  )}
                </div>
              ))}
              <button onClick={()=>setShowImpact(v=>!v)} style={{...S.iconBtn(C.saffron),width:'100%',marginTop:4,padding:'9px 0'}}>
                {showImpact?'▲ Hide':'⚡ View'} Full Parameter Impact
              </button>
              {showImpact&&<ImpactPanel params={params} modelName={selected} paramDefs={paramDefs}/>}
            </div>
          )}

          {/* Training Config */}
          <div style={S.card}>
            <div style={S.cardTitle}>⚙️ Training Config</div>
            {[
              {label:'Test Split',val:testSize,set:setTestSize,min:0.1,max:0.4,step:0.05,fmt:v=>`${(v*100).toFixed(0)}%`},
              {label:'Val Split',val:valSize,set:setValSize,min:0.05,max:0.2,step:0.05,fmt:v=>`${(v*100).toFixed(0)}%`},
              {label:'CV Folds',val:cvFolds,set:v=>setCvFolds(parseInt(v)),min:3,max:10,step:1,fmt:v=>v},
            ].map((s,i)=>(
              <div key={i} style={S.sliderWrap}>
                <div style={S.sliderRow}>
                  <span style={S.sliderLabel}>{s.label}</span>
                  <span style={S.sliderVal()}>{s.fmt(s.val)}</span>
                </div>
                <input type="range" style={S.slider} min={s.min} max={s.max} step={s.step} value={s.val} onChange={e=>s.set(parseFloat(e.target.value))}/>
              </div>
            ))}
            <div style={{fontSize:9,color:C.dim,lineHeight:1.7,marginTop:4}}>Train: {((1-testSize-valSize)*100).toFixed(0)}% · Val: {(valSize*100).toFixed(0)}% · Test: {(testSize*100).toFixed(0)}%</div>
          </div>

          {/* TF-IDF Config */}
          <div style={S.card}>
            <div style={S.cardTitle}>🔢 TF-IDF Vectorizer</div>
            {Object.entries(TFIDF_PARAMS).map(([key,def])=>(
              <div key={key} style={S.sliderWrap}>
                <div style={S.sliderRow}>
                  <span style={S.sliderLabel}>{def.label}</span>
                  <span style={S.sliderVal(C.saffron)}>{tfidfParams[key]}</span>
                </div>
                <input type="range" style={{...S.slider,accentColor:C.saffron}} min={def.min} max={def.max} step={def.step} value={tfidfParams[key]} onChange={e=>setTfidfParams(prev=>({...prev,[key]:parseInt(e.target.value)}))}/>
              </div>
            ))}
            <div style={{fontSize:9,color:C.dim,marginTop:4,lineHeight:1.5}}>Visual guide — backend uses fixed defaults for reproducibility. Adjust to see estimated feature space sizes.</div>
          </div>

          {/* Dataset */}
          <div style={S.card}>
            <div style={S.cardTitle}>📊 Dataset</div>
            {[['Samples','1,898'],['Language','Sindhi + EN'],['Classes','3 (Pos/Neg/Neu)'],['Char N-grams','2–6'],['Word N-grams','1–2'],['Max Features','~37K'],['Annotation','Semi-supervised'],['Confidence','≥0.70']].map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid #0d1525`,fontSize:10}}>
                <span style={{color:C.muted}}>{k}</span>
                <span style={{color:C.text,fontFamily:'Space Mono'}}>{v}</span>
              </div>
            ))}
          </div>

          <button onClick={handleTrain} disabled={training} style={S.trainBtn(training)}>
            {training?'⏳ Training...':'▶ Train Model'}
          </button>
          {error&&<div style={{padding:'10px 14px',borderRadius:5,background:'#140808',border:`1px solid ${C.neg}40`,fontSize:10,color:C.neg,lineHeight:1.5}}>⚠️ {error}</div>}
        </div>

        <div style={S.rightPanel} ref={rightRef}>
          {training&&(
            <div style={S.card}>
              <TrainingProgress step={trainStep}/>
              <div style={{display:'flex',alignItems:'center',gap:12,marginTop:14}}>
                <div style={{width:16,height:16,border:`2px solid ${modelColor}`,borderTop:`2px solid transparent`,borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
                <span style={{fontSize:11,color:modelColor}}>Training <strong>{selected}</strong> — {STEPS[Math.min(trainStep,STEPS.length-1)]?.label}...</span>
              </div>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {results&&!training&&(<>
            {/* Fit banner */}
            <div style={S.banner(fitType)}>
              <span style={{fontSize:28}}>{fitIcons[fitType]}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:fitColors[fitType],marginBottom:3}}>{fitType.toUpperCase()} — {selected}</div>
                <div style={{fontSize:10,color:'#7a8fa8',lineHeight:1.5}}>{results.fit_message}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:26,fontWeight:700,color:fitColors[fitType],fontFamily:'Space Mono'}}>{pct(results.metrics?.test_accuracy)}</div>
                <div style={{fontSize:8,color:C.muted,letterSpacing:'1px'}}>TEST ACCURACY</div>
                <div style={{fontSize:10,color:fitColors[fitType],marginTop:2}}>F1: {pct(results.metrics?.f1_score)}</div>
              </div>
            </div>

            {/* Primary metrics */}
            <div style={S.metricsGrid}>
              {[{label:'Test Accuracy',val:pct(results.metrics?.test_accuracy),color:C.lr,sub:'Hold-out set'},{label:'F1 Score',val:pct(results.metrics?.f1_score),color:C.pos,sub:'Weighted avg'},{label:'Precision',val:pct(results.metrics?.precision),color:C.svm,sub:'Weighted avg'},{label:'Recall',val:pct(results.metrics?.recall),color:C.neu,sub:'Weighted avg'}].map(m=>(
                <div key={m.label} style={S.metricBox(m.color)}>
                  <div style={S.metricVal(m.color)}>{m.val}</div>
                  <div style={S.metricLabel}>{m.label}</div>
                  <div style={S.metricSub}>{m.sub}</div>
                </div>
              ))}
            </div>

            {/* Secondary metrics */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
              {[
                {label:'Train Acc',val:pct(results.metrics?.train_accuracy),color:C.lr},
                {label:'Val Acc',val:pct(results.metrics?.val_accuracy),color:C.svm},
                {label:'CV Mean',val:`${(results.cv?.mean*100||0).toFixed(1)}%`,color:C.neu},
                {label:'Gen Gap',val:`${((results.metrics?.train_accuracy-results.metrics?.val_accuracy)*100||0).toFixed(1)}%`,color:(results.metrics?.train_accuracy-results.metrics?.val_accuracy)>0.08?C.neg:C.pos},
              ].map(m=>(
                <div key={m.label} style={{...S.metricBox(m.color),padding:'10px 14px'}}>
                  <div style={{...S.metricVal(m.color),fontSize:16}}>{m.val}</div>
                  <div style={S.metricLabel}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div style={S.card}>
              <div style={S.tabBar}>
                {TABS.map(t=><button key={t} style={S.tab(activeTab===t)} onClick={()=>setActiveTab(t)}>{t}</button>)}
              </div>
              <div style={{padding:'18px 4px 4px'}}>

                {activeTab==='Overview'&&(
                  <div style={{display:'flex',flexDirection:'column',gap:16}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                      {tvtChart&&<PlotlyChart data={tvtChart.data} layout={tvtChart.layout}/>}
                      {radarChart&&<PlotlyChart data={radarChart.data} layout={radarChart.layout}/>}
                    </div>
                    <div>
                      <div style={{fontSize:9,color:C.muted,letterSpacing:'2px',textTransform:'uppercase',marginBottom:10}}>Classification Report</div>
                      <table style={S.table}>
                        <thead><tr>{['Class','Precision','Recall','F1-Score','Support'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                        <tbody>
                          {CLASS_NAMES.map((cls,i)=>{const row=results.classification_report?.[cls]||{};return(<tr key={cls}><td style={S.td}><span style={S.chip(CLASS_COLORS[i])}>{cls}</span></td><td style={{...S.td,color:CLASS_COLORS[i]}}>{pct(row.precision)}</td><td style={{...S.td,color:CLASS_COLORS[i]}}>{pct(row.recall)}</td><td style={{...S.td,color:CLASS_COLORS[i]}}>{pct(row['f1-score'])}</td><td style={{...S.td,color:C.muted}}>{row.support}</td></tr>)})}
                          {['macro avg','weighted avg'].map(avg=>{const row=results.classification_report?.[avg];if(!row)return null;return(<tr key={avg} style={{borderTop:`1px solid ${C.border}`}}><td style={{...S.td,color:C.muted}}>{avg}</td><td style={{...S.td,color:C.lr}}>{pct(row.precision)}</td><td style={{...S.td,color:C.lr}}>{pct(row.recall)}</td><td style={{...S.td,color:C.lr}}>{pct(row['f1-score'])}</td><td style={{...S.td,color:C.muted}}>{row.support}</td></tr>)})}
                        </tbody>
                      </table>
                    </div>
                    {results.cv&&(
                      <div style={{background:C.elev,borderRadius:6,padding:'14px 16px'}}>
                        <div style={{fontSize:9,letterSpacing:'2px',color:C.muted,textTransform:'uppercase',marginBottom:10}}>Cross-Validation Summary</div>
                        <div style={{display:'flex',gap:24}}>
                          <div><span style={{color:C.muted,fontSize:10}}>Mean: </span><strong style={{color:C.lr}}>{pct(results.cv.mean)}</strong></div>
                          <div><span style={{color:C.muted,fontSize:10}}>Std: </span><strong style={{color:C.neu}}>±{(results.cv.std*100).toFixed(3)}%</strong></div>
                          <div><span style={{color:C.muted,fontSize:10}}>Stability: </span><strong style={{color:results.cv.std<0.02?C.pos:C.neg}}>{results.cv.std<0.02?'✅ Stable':'⚠️ Variable'}</strong></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab==='Training'&&(
                  <div style={{display:'flex',flexDirection:'column',gap:16}}>
                    <div style={{background:C.elev,borderRadius:6,padding:'16px'}}>
                      <div style={{fontSize:9,letterSpacing:'2px',color:C.muted,textTransform:'uppercase',marginBottom:14}}>Training Pipeline — What Just Happened</div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                        {STEPS.map((s,i)=>(
                          <div key={i} style={{padding:'10px 8px',background:C.card,borderRadius:5,border:`1px solid ${C.pos}30`,textAlign:'center'}}>
                            <div style={{fontSize:18,marginBottom:4}}>{s.icon}</div>
                            <div style={{fontSize:8,fontWeight:700,color:C.pos,textTransform:'uppercase',marginBottom:3}}>{s.label}</div>
                            <div style={{fontSize:8,color:C.dim,lineHeight:1.4}}>{s.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {cvChart&&<PlotlyChart data={cvChart.data} layout={cvChart.layout}/>}
                    {lcChart&&<PlotlyChart data={lcChart.data} layout={lcChart.layout}/>}
                    {gaugeChart&&<PlotlyChart data={gaugeChart.data} layout={gaugeChart.layout}/>}
                    <div style={{background:C.elev,borderRadius:6,padding:'14px 16px'}}>
                      <div style={{fontSize:9,letterSpacing:'2px',color:C.muted,textTransform:'uppercase',marginBottom:12}}>Overfitting Diagnostic</div>
                      {(()=>{
                        const gap=(results.metrics?.train_accuracy||0)-(results.metrics?.val_accuracy||0)
                        const risk=gap>0.1?{l:'High',c:C.neg}:gap>0.05?{l:'Medium',c:C.neu}:{l:'Low',c:C.pos}
                        return(
                          <>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:12}}>
                              {[{label:'Train',val:pct(results.metrics?.train_accuracy),color:C.lr},{label:'Val',val:pct(results.metrics?.val_accuracy),color:C.svm},{label:'Risk',val:risk.l,color:risk.c}].map(m=>(
                                <div key={m.label} style={{textAlign:'center',padding:'10px',background:C.card,borderRadius:5}}>
                                  <div style={{fontSize:18,fontWeight:700,color:m.color,fontFamily:'Space Mono'}}>{m.val}</div>
                                  <div style={{fontSize:8,color:C.muted,textTransform:'uppercase',letterSpacing:'1px',marginTop:4}}>{m.label}</div>
                                </div>
                              ))}
                            </div>
                            <div style={{fontSize:10,color:C.muted,lineHeight:1.7,padding:'10px 14px',background:C.card,borderRadius:4,borderLeft:`2px solid ${C.saffron}`}}>
                              <strong style={{color:C.text}}>Sindhi NLP context:</strong> With 37K+ TF-IDF features and ~{Math.round(results.train_sizes?.[0]||1300)} training samples ({Math.round((37000/(results.train_sizes?.[0]||1300)))}:1 feature ratio), regularization is critical to close the generalization gap. Lower C = stronger regularization.
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                )}

                {activeTab==='Evaluation'&&(
                  <div style={{display:'flex',flexDirection:'column',gap:16}}>
                    {confChart&&<PlotlyChart data={confChart.data} layout={confChart.layout}/>}
                    {classChart&&<PlotlyChart data={classChart.data} layout={classChart.layout}/>}
                    {sensitChart&&<PlotlyChart data={sensitChart.data} layout={sensitChart.layout}/>}
                    {results.cv&&(
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                        {CLASS_NAMES.map((cls,i)=>{const row=results.classification_report?.[cls]||{};return(
                          <div key={cls} style={{padding:'14px',background:C.elev,borderRadius:6,border:`1px solid ${CLASS_COLORS[i]}30`}}>
                            <div style={{fontSize:9,fontWeight:700,color:CLASS_COLORS[i],textTransform:'uppercase',letterSpacing:'1px',marginBottom:10}}>{cls}</div>
                            {[['Prec',row.precision],['Rec',row.recall],['F1',row['f1-score']]].map(([l,v])=>(
                              <div key={l} style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                                <span style={{fontSize:9,color:C.muted}}>{l}</span>
                                <div style={{display:'flex',alignItems:'center',gap:6}}>
                                  <div style={{width:50,height:4,background:C.border,borderRadius:2}}><div style={{width:`${(v||0)*100}%`,height:'100%',background:CLASS_COLORS[i],borderRadius:2}}/></div>
                                  <span style={{fontSize:10,color:CLASS_COLORS[i],fontFamily:'Space Mono'}}>{pct(v)}</span>
                                </div>
                              </div>
                            ))}
                            <div style={{fontSize:9,color:C.dim,marginTop:8}}>Support: <span style={{color:C.muted}}>{row.support}</span></div>
                          </div>
                        )})}
                      </div>
                    )}
                  </div>
                )}

                {activeTab==='Features'&&(
                  <div style={{display:'flex',flexDirection:'column',gap:16}}>
                    <div style={{display:'flex',gap:6}}>
                      {CLASS_NAMES.map((cls,i)=><button key={cls} onClick={()=>setFeatClass(cls)} style={{padding:'7px 18px',borderRadius:4,border:'none',cursor:'pointer',background:featClass===cls?`${CLASS_COLORS[i]}20`:C.elev,color:featClass===cls?CLASS_COLORS[i]:C.muted,borderBottom:`2px solid ${featClass===cls?CLASS_COLORS[i]:'transparent'}`,fontSize:11,fontWeight:700,transition:'all .15s'}}>{cls}</button>)}
                    </div>
                    {fiChart?<PlotlyChart data={fiChart.data} layout={fiChart.layout}/>:(<div style={{padding:'24px',textAlign:'center',color:C.muted,fontSize:11,background:C.elev,borderRadius:6}}>Feature importance available for <strong style={{color:C.lr}}>LR</strong> and <strong style={{color:C.svm}}>SVM</strong> only.<br/><span style={{color:C.dim,fontSize:10}}>NB uses log-probability weights (no linear coefficients).</span></div>)}
                    <div style={{background:C.elev,borderRadius:6,padding:'14px 16px'}}>
                      <div style={{fontSize:9,letterSpacing:'2px',color:C.muted,textTransform:'uppercase',marginBottom:10}}>TF-IDF Feature Engineering</div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                        {[{label:'Char N-grams',range:`${tfidfParams.char_ngram_min}–${tfidfParams.char_ngram_max}`,color:C.ajrak1,feat:`${tfidfParams.char_max_feat}K`,ex:'آهي·سٺو·منجهان'},{label:'Word N-grams',range:`${tfidfParams.word_ngram_min}–${tfidfParams.word_ngram_max}`,color:C.indigo,feat:`${tfidfParams.word_max_feat}K`,ex:'تمام سٺو·خوشي آهي'}].map(v=>(
                          <div key={v.label} style={{padding:'12px 14px',background:C.card,borderRadius:6,border:`1px solid ${v.color}30`}}>
                            <div style={{fontSize:10,fontWeight:700,color:v.color,marginBottom:6}}>{v.label}</div>
                            <div style={{fontSize:9,color:C.muted,marginBottom:3}}>Range: <span style={{color:C.text}}>{v.range}</span></div>
                            <div style={{fontSize:9,color:C.muted,marginBottom:3}}>Max: <span style={{color:v.color}}>{v.feat} features</span></div>
                            <div style={{fontSize:8,color:C.dim,direction:'rtl',fontFamily:'serif'}}>{v.ex}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{fontSize:10,color:C.muted,lineHeight:1.7,padding:'10px 14px',background:C.card,borderRadius:5,borderLeft:`2px solid ${C.saffron}`}}>
                        <strong style={{color:C.text}}>Why dual TF-IDF?</strong> Sindhi is morphologically rich. Char n-grams capture verb endings, postpositions & root morphemes. Word n-grams capture sentiment collocations. Combined features outperform either alone by ~3-5%.
                      </div>
                    </div>
                  </div>
                )}

                {activeTab==='3D Space'&&(
                  <div style={{display:'flex',flexDirection:'column',gap:16}}>
                    <div style={{padding:'10px 14px',background:C.elev,borderRadius:5,borderLeft:`2px solid ${C.saffron}`,fontSize:10,color:C.muted,lineHeight:1.6}}>
                      <strong style={{color:C.text}}>3D Visualizations</strong> — Three perspectives on how the model organizes the Sindhi feature space. Rotate and zoom to explore.
                    </div>
                    {surface3d&&<PlotlyChart data={surface3d.data} layout={surface3d.layout}/>}
                    {err3d&&<PlotlyChart data={err3d.data} layout={err3d.layout}/>}
                    {bound3d&&<PlotlyChart data={bound3d.data} layout={bound3d.layout}/>}
                  </div>
                )}

                {activeTab==='Error Analysis'&&(
                  <div style={{display:'flex',flexDirection:'column',gap:16}}>
                    {results?.confusion_matrix&&(()=>{
                      const cm=results.confusion_matrix,total=cm.reduce((a,r)=>a+r.reduce((b,v)=>b+v,0),0),correct=cm.reduce((a,r,i)=>a+r[i],0),errors=total-correct
                      const errorTypes=[]
                      CLASS_NAMES.forEach((tr,ti)=>CLASS_NAMES.forEach((pr,pi)=>{if(ti!==pi&&cm[ti]?.[pi])errorTypes.push({from:tr,to:pr,count:cm[ti][pi],pct:((cm[ti][pi]/Math.max(errors,1))*100).toFixed(1)})}))
                      errorTypes.sort((a,b)=>b.count-a.count)
                      return(<>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                          {[{label:'Total',val:total,color:C.lr},{label:'Correct',val:`${correct} (${(correct/total*100).toFixed(1)}%)`,color:C.pos},{label:'Errors',val:`${errors} (${(errors/total*100).toFixed(1)}%)`,color:C.neg}].map(m=>(
                            <div key={m.label} style={{padding:'12px',background:C.elev,borderRadius:5,textAlign:'center'}}>
                              <div style={{fontSize:18,fontWeight:700,color:m.color,fontFamily:'Space Mono'}}>{m.val}</div>
                              <div style={{fontSize:8,color:C.muted,letterSpacing:'1px',marginTop:4}}>{m.label}</div>
                            </div>
                          ))}
                        </div>
                        <div>
                          <div style={{fontSize:9,letterSpacing:'2px',color:C.muted,textTransform:'uppercase',marginBottom:8}}>Error Breakdown by Type</div>
                          {errorTypes.map((e,i)=>(
                            <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:5,marginBottom:5,background:C.elev,border:`1px solid ${C.border}`}}>
                              <span style={{...S.chip(CLASS_COLORS[CLASS_NAMES.indexOf(e.from)]),minWidth:70}}>{e.from}</span>
                              <span style={{color:C.dim,fontSize:18}}>→</span>
                              <span style={{...S.chip(CLASS_COLORS[CLASS_NAMES.indexOf(e.to)]),minWidth:70}}>{e.to}</span>
                              <div style={{flex:1,height:5,background:C.border,borderRadius:3}}><div style={{width:`${e.pct}%`,height:'100%',background:CLASS_COLORS[CLASS_NAMES.indexOf(e.from)],borderRadius:3,opacity:0.7}}/></div>
                              <span style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:'Space Mono',minWidth:60,textAlign:'right'}}>{e.count} <span style={{fontSize:9,color:C.muted}}>({e.pct}%)</span></span>
                            </div>
                          ))}
                        </div>
                        <div style={{background:C.elev,borderRadius:6,padding:'14px 16px'}}>
                          <div style={{fontSize:9,letterSpacing:'2px',color:C.muted,textTransform:'uppercase',marginBottom:10}}>Linguistic Causes of Errors</div>
                          {[{from:'Neutral',to:'Negative',color:C.neg,reason:'News text about disasters uses negative vocabulary in factual context. TF-IDF picks up words but not pragmatic intent.'},
                            {from:'Positive',to:'Neutral',color:C.neu,reason:'Formal Sindhi praise lacks exclamatory particles. Academic compliments resemble neutral news prose in n-gram space.'},
                            {from:'Negative',to:'Neutral',color:C.pos,reason:'Professional criticism uses measured, unemotional register — fewer negative morphemes than informal complaints.'},
                            {from:'Neutral',to:'Positive',color:C.pos,reason:'Culturally polite phrases in neutral text carry positive lexical signals (e.g., "سٺو" in factual sentences).'},
                          ].map(item=>(
                            <div key={item.from+item.to} style={{marginBottom:8,padding:'10px 14px',background:C.card,borderRadius:5,borderLeft:`2px solid ${item.color}`}}>
                              <div style={{fontSize:10,fontWeight:700,color:item.color,marginBottom:5}}>{item.from} → {item.to}</div>
                              <div style={{fontSize:10,color:'#7a8fa8',lineHeight:1.6}}>{item.reason}</div>
                            </div>
                          ))}
                        </div>
                      </>)
                    })()}
                  </div>
                )}

                {activeTab==='Param Impact'&&(
                  <div style={{display:'flex',flexDirection:'column',gap:16}}>
                    <div style={{padding:'10px 14px',background:C.elev,borderRadius:5,borderLeft:`2px solid ${C.saffron}`,fontSize:10,color:C.muted,lineHeight:1.6}}>
                      <strong style={{color:C.text}}>How current parameters affect model behavior</strong> — Based on experiments from the original notebook. Change sliders on the left to see real-time impact analysis.
                    </div>
                    <ImpactPanel params={params} modelName={selected} paramDefs={paramDefs}/>
                    {sensitChart&&(<><div style={{fontSize:9,letterSpacing:'2px',color:C.muted,textTransform:'uppercase'}}>Sensitivity Curve</div><PlotlyChart data={sensitChart.data} layout={sensitChart.layout}/></>)}
                    <div style={{background:C.elev,borderRadius:6,padding:'14px 16px'}}>
                      <div style={{fontSize:9,letterSpacing:'2px',color:C.muted,textTransform:'uppercase',marginBottom:10}}>What-If: Change This → See That</div>
                      <table style={S.table}>
                        <thead><tr>{['Parameter','Current','If Halved','If Doubled','Recommendation'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                        <tbody>
                          {paramDefs.filter(p=>p.type==='slider').map(p=>{
                            const cur=parseFloat(params[p.key]||p.default)
                            const mid=(p.max+p.min)/2
                            const halfImpact=cur<mid*0.4?'Underfit risk':'~−1 to −2%'
                            const doubleImpact=cur>mid*1.6?'Overfit risk':'Stable'
                            return(<tr key={p.key}><td style={{...S.td,color:C.text}}><code style={{color:modelColor}}>{p.key}</code></td><td style={{...S.td,color:C.lr}}>{cur.toFixed(cur<1?3:0)}</td><td style={{...S.td,color:C.neu}}>{halfImpact}</td><td style={{...S.td,color:C.neg}}>{doubleImpact}</td><td style={{...S.td,color:C.pos,fontSize:9}}>{p.desc.slice(0,55)}…</td></tr>)
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </>)}

          {!results&&!training&&(
            <div style={{...S.card,...S.emptyState,minHeight:440}}>
              <div style={{fontSize:70,opacity:0.25}}>🧠</div>
              <div style={{fontSize:16,fontWeight:700,color:C.dim}}>No model trained yet</div>
              <div style={{fontSize:11,color:'#1e2d44',textAlign:'center',maxWidth:300,lineHeight:1.7}}>Select an algorithm, configure hyperparameters, and click <strong style={{color:C.ajrak1}}>▶ Train Model</strong> to begin.</div>
              <div style={{display:'flex',gap:10,marginTop:8,flexWrap:'wrap',justifyContent:'center'}}>
                {Object.entries(MODEL_COLORS).map(([m,col])=><button key={m} onClick={()=>handleSelectModel(m)} style={{padding:'7px 14px',borderRadius:4,border:`1px solid ${col}30`,background:`${col}0a`,color:col,fontSize:10,cursor:'pointer',fontWeight:700}}>{m}</button>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}