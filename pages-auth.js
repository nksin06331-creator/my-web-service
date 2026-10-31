// GitHub Pages: decrypt questions locally. Passwords and answers never leave the browser.
(() => {
  let questions = null;
  const response = (status, data) => ({status, ok: status >= 200 && status < 300, json: async () => data});
  const bytes = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));
  window.formAPI = async (path, options = {}) => {
    if (path === '/api/questions') return questions ? response(200, questions) : response(401, {});
    if (path === '/api/logout') { questions = null; return response(200, {}); }
    if (path !== '/api/login') return response(404, {});
    const result = await fetch('./questions.enc.json', {cache: 'no-store'});
    if (!result.ok) throw new Error('質問ファイルを読み込めませんでした。');
    const encrypted = await result.json();
    try {
      const password = JSON.parse(options.body).password;
      const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
      const key = await crypto.subtle.deriveKey({name: 'PBKDF2', salt: bytes(encrypted.salt), iterations: encrypted.iterations, hash: 'SHA-256'}, material, {name: 'AES-GCM', length: 256}, false, ['decrypt']);
      const plain = await crypto.subtle.decrypt({name: 'AES-GCM', iv: bytes(encrypted.iv)}, key, bytes(encrypted.data));
      questions = JSON.parse(new TextDecoder().decode(plain));
      return response(200, {});
    } catch {
      return response(401, {error: 'パスワードが違います。もう一度お試しください。'});
    }
  };
})();
