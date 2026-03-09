import { supabase } from "./supabase";

const STORAGE_KEY = "wordpop_family_id";

export function getFamilyId() {
  return localStorage.getItem(STORAGE_KEY);
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
}

export async function loginWithPin(pin) {
  const { data } = await supabase
    .from("families")
    .select("id")
    .eq("pin", pin)
    .maybeSingle();
  if (!data) return null;
  localStorage.setItem(STORAGE_KEY, data.id);
  return data.id;
}

export async function checkPinAvailable(pin) {
  const { data } = await supabase
    .from("families")
    .select("id")
    .eq("pin", pin)
    .maybeSingle();
  return !data;
}

export async function createFamilyFromInvite(token, pin) {
  const { data: inviter } = await supabase
    .from("families")
    .select("id, invite_token_expires_at")
    .eq("invite_token", token)
    .maybeSingle();
  if (!inviter) return { error: "邀请链接无效" };
  if (inviter.invite_token_expires_at && new Date(inviter.invite_token_expires_at) < new Date()) {
    return { error: "邀请链接已过期，请让对方重新生成" };
  }

  const available = await checkPinAvailable(pin);
  if (!available) return { error: "该口令已被使用，请换一个" };

  const { data: newFamily, error } = await supabase
    .from("families")
    .insert({ pin })
    .select()
    .single();
  if (error) return { error: "创建失败，请重试" };

  localStorage.setItem(STORAGE_KEY, newFamily.id);
  return { familyId: newFamily.id };
}

export async function getDailyNewWords() {
  const familyId = getFamilyId();
  if (!familyId) return 5;
  const { data } = await supabase
    .from("families")
    .select("daily_new_words")
    .eq("id", familyId)
    .maybeSingle();
  return data?.daily_new_words ?? 5;
}

export async function updateDailyNewWords(count) {
  const familyId = getFamilyId();
  if (!familyId) return false;
  const val = Math.max(5, Math.min(30, Math.round(count)));
  const { error } = await supabase
    .from("families")
    .update({ daily_new_words: val })
    .eq("id", familyId);
  return !error;
}

export async function getSelectedBanks() {
  const familyId = getFamilyId();
  if (!familyId) return ["custom"];
  const { data } = await supabase
    .from("families")
    .select("selected_banks")
    .eq("id", familyId)
    .maybeSingle();
  return data?.selected_banks ?? ["custom"];
}

export async function updateSelectedBanks(banks) {
  const familyId = getFamilyId();
  if (!familyId) return false;
  const { error } = await supabase
    .from("families")
    .update({ selected_banks: banks })
    .eq("id", familyId);
  return !error;
}

export async function getPronunciationPref() {
  const familyId = getFamilyId();
  if (!familyId) return "us";
  const { data } = await supabase
    .from("families")
    .select("pronunciation_pref")
    .eq("id", familyId)
    .maybeSingle();
  return data?.pronunciation_pref ?? "us";
}

export async function updatePronunciationPref(pref) {
  const familyId = getFamilyId();
  if (!familyId) return false;
  const { error } = await supabase
    .from("families")
    .update({ pronunciation_pref: pref })
    .eq("id", familyId);
  return !error;
}

export async function getInviteToken() {
  const familyId = getFamilyId();
  if (!familyId) return null;
  const newToken = crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("families")
    .update({ invite_token: newToken, invite_token_expires_at: expiresAt })
    .eq("id", familyId);
  if (error) return null;
  return newToken;
}
