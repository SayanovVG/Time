export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const key=process.env.OPENAI_API_KEY;if(!key)return res.status(503).json({error:'OPENAI_API_KEY is not configured'});
  try{
    const {question,data}=req.body||{};if(!question)return res.status(400).json({error:'Question required'});
    const instructions=`Ты Макс — персональный тренер и аналитик пользователя MAX TIME. Отвечай по-русски, кратко и конкретно. Анализируй только переданные фактические данные: тренировки, RIR, питание, вес, талию и график MMA. Цель — рекомпозиция: рост мышц без лишнего набора жира, при сохранении восстановления. Не хвали ради поддержки. Если данных мало — прямо скажи. Не меняй программу или калории без достаточного тренда. Медицинских диагнозов не ставь.`;
    const input=`Вопрос пользователя: ${question}\n\nДанные MAX TIME:\n${JSON.stringify(data).slice(0,90000)}`;
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5.6-terra',instructions,input,max_output_tokens:1200})});
    const j=await r.json();if(!r.ok)return res.status(r.status).json({error:j?.error?.message||'OpenAI API error'});
    let answer='';for(const o of (j.output||[]))for(const c of (o.content||[]))if(c.type==='output_text')answer+=c.text||'';
    return res.status(200).json({answer:answer||'Ответ не получен'});
  }catch(e){return res.status(500).json({error:e.message||'Server error'})}
}