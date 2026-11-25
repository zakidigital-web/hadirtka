export interface LoginTeacher {
  id: string;
  username: string;
  name: string;
  title: string;
  visible: boolean;
}

export async function accountRequest<T>(action: string, body?: object): Promise<T> {
  const response = await fetch('/api/accounts/' + action, body ? {
    method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body),
  } : {cache: 'no-store'});
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || 'Permintaan akun gagal. Silakan masuk kembali.');
  }
  return response.json();
}
