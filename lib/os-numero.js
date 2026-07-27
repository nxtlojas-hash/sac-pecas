// Decide se um texto de busca e um numero de OS. Aceita "OS-2026-0426",
// "os 2026 0426" e o numero solto ("426") — que e como a equipe digita.
// Rejeita protocolo de atendimento (PV-), CPF e telefone (digitos demais).
function pareceNumeroOS(texto) {
  var s = String(texto || '').trim();
  if (!s) return false;
  if (/^pv/i.test(s)) return false;
  if (/^os/i.test(s)) return true;
  var soDigitos = s.replace(/\D/g, '');
  if (soDigitos !== s.replace(/[\s.\-\/]/g, '')) return false; // tem letra
  return soDigitos.length >= 1 && soDigitos.length <= 4;
}

if (typeof module !== 'undefined') module.exports = { pareceNumeroOS };
