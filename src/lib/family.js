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
    .select("id")
    .eq("invite_token", token)
    .maybeSingle();
  if (!inviter) return { error: "邀请链接无效" };

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

export async function getInviteToken() {
  const familyId = getFamilyId();
  if (!familyId) return null;
  const { data } = await supabase
    .from("families")
    .select("invite_token")
    .eq("id", familyId)
    .maybeSingle();
  return data?.invite_token || null;
}
