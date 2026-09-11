import { createClient } from 'npm:@supabase/supabase-js@2.115.0';

// Custom authentication: a 256-bit single-use capability, stored only as SHA-256.
// No account can be created until the private database atomically claims it.
// verify_jwt is false because the recipient does not have an account yet.
const origin = 'https://sayanovvg.github.io';
const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
const reply = (body, status=200) => new Response(JSON.stringify(body), {status,headers});
Deno.serve(async req => {
  if (req.headers.get('Origin') && req.headers.get('Origin') !== origin) return reply({error:'Недопустимый источник запроса.'},403);
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers});
  if (req.method !== 'POST') return reply({error:'Используй форму подключения.'},405);
  let body;
  try { const text=await req.text(); if(text.length>4096) return reply({error:'Слишком большой запрос.'},413); body=JSON.parse(text); }
  catch { return reply({error:'Проверь данные формы.'},400); }
  const {token,email,password}=body||{};
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token)) return reply({error:'Открой личную ссылку подключения из чата.'},401);
  if(typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof password!=='string'||password.length<12||password.length>128) return reply({error:'Введи свою почту и пароль от 12 до 128 символов.'},400);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
  const admin=createClient(Deno.env.get('SUPABASE_URL'),Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
  const claimed=await admin.rpc('planner_claim_setup',{p_token_hash:hash});
  if(claimed.error) return reply({error:'Подключение временно недоступно. Попробуй позже.'},503);
  if(claimed.data!==true) return reply({error:'Эта ссылка уже использована или устарела. Если аккаунт создан, нажми «Войти». Иначе попроси Макса новую ссылку.'},401);
  let created;
  try { created=await admin.auth.admin.createUser({email:email.trim(),password,email_confirm:true,app_metadata:{planner:true}}); }
  catch { return reply({error:'Не удалось проверить результат подключения. Попробуй войти с указанными данными; если не получится, попроси новую ссылку.'},503); }
  if(created.error||!created.data?.user){
    await admin.rpc('planner_finish_setup',{p_token_hash:hash,p_owner_id:null,p_release:true});
    return reply({error:created.error?.code==='email_exists'?'Этот аккаунт уже есть. Нажми «Войти».':'Не удалось создать аккаунт. Проверь почту и выбери более сложный пароль.'},400);
  }
  // If recording the owner fails after Auth succeeds, leave the token spent.
  // The user can still sign in with the password they just chose.
  await admin.rpc('planner_finish_setup',{p_token_hash:hash,p_owner_id:created.data.user.id,p_release:false});
  return reply({ok:true});
});
