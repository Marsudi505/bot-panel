export const command = ["calc", "kalkulator"]

const html = `<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:sans-serif;user-select:none}
body{background:#121212;color:#fff;padding:20px 0;display:block}
.calc{width:90%;max-width:260px;margin:0 auto;background:#000;border-radius:20px;padding:15px;box-shadow:0 10px 30px rgba(0,0,0,0.5)}
.display{text-align:right;margin-bottom:15px;padding:0 5px}
.display .prev{color:#aaa;font-size:14px;min-height:18px}
.display .curr{font-size:32px;font-weight:bold;overflow:hidden;text-overflow:ellipsis}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
button{height:50px;border-radius:50%;border:none;font-size:18px;font-weight:500;cursor:pointer;transition:filter 0.1s}
button:active{filter:brightness(1.3)}
.num{background:#333;color:#fff}
.op{background:#f1a33c;color:#fff}
.special{background:#a5a5a5;color:#000}
.span-2{grid-column:span 2;border-radius:25px}
</style>
<div class="calc">
  <div class="display">
    <div class="prev" id="prev"></div>
    <div class="curr" id="curr">0</div>
  </div>
  <div class="grid">
    <button class="special" onclick="clearAll()">AC</button>
    <button class="special" onclick="toggleSign()">+/-</button>
    <button class="special" onclick="perc()">%</button>
    <button class="op" onclick="setOp('÷')">÷</button>
    <button class="num" onclick="appNum('7')">7</button>
    <button class="num" onclick="appNum('8')">8</button>
    <button class="num" onclick="appNum('9')">9</button>
    <button class="op" onclick="setOp('×')">×</button>
    <button class="num" onclick="appNum('4')">4</button>
    <button class="num" onclick="appNum('5')">5</button>
    <button class="num" onclick="appNum('6')">6</button>
    <button class="op" onclick="setOp('-')">−</button>
    <button class="num" onclick="appNum('1')">1</button>
    <button class="num" onclick="appNum('2')">2</button>
    <button class="num" onclick="appNum('3')">3</button>
    <button class="op" onclick="setOp('+')">+</button>
    <button class="num span-2" style="text-align:left;padding-left:25px" onclick="appNum('0')">0</button>
    <button class="num" onclick="appNum('.')">.</button>
    <button class="op" onclick="calc()">=</button>
  </div>
</div>
<script>
let curr = '0', prev = '', op = null;
const cEl = document.getElementById('curr'), pEl = document.getElementById('prev');
function update(){
  cEl.textContent = curr;
  pEl.textContent = op ? prev + ' ' + op : '';
}
function appNum(n){
  if(n=='.' && curr.includes('.')) return;
  if(curr==='0' && n!=='.') curr = n; else curr += n;
  update();
}
function clearAll(){ curr='0'; prev=''; op=null; update(); }
function toggleSign(){ curr = (parseFloat(curr)*-1).toString(); update(); }
function perc(){ curr = (parseFloat(curr)/100).toString(); update(); }
function setOp(o){
  if(op && prev){ calc(); }
  op = o; prev = curr; curr = '0'; update();
}
function calc(){
  if(!op || !prev) return;
  const a = parseFloat(prev), b = parseFloat(curr);
  let res = 0;
  if(op==='+') res = a+b; else if(op==='-') res = a-b;
  else if(op==='×') res = a*b; else if(op==='÷') res = b===0 ? 'Error' : a/b;
  curr = String(res); prev = ''; op = null; update();
}
</script>
</html>`

const payloadData = {
  response_id: "calc-rich-001",
  sections: [
    {
      view_model: {
        primitive: {
          __typename: "GenAIaeacdsnwHtmlPrimitive",
          payload: html,
          trusted_sources: ["nixel.dev"]
        },
        __typename: "GenAISingleLayoutViewModel"
      }
    }
  ]
}

const certificateChain = [
  "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRGEOvtJr968bbpKdZreOTwkk9aPN++XPE60RfuzNLkXXc7LE8BOkJOWRpo2oNXaRJ3uCNJ43HY3A+oetnvHSfcxWqmvvTSrBOI5V1NOD6RMsZ/st1XVPUx83AGps1l5jYBOYzqMNy6un2tToJ2Bt9bXRo29tWLZTu8m7TNY/hISwVpVc5tjSet5U7btPN+dMIx2UvykB1jcbWGsdklheeuz8RXSStNXzeaGvsf1lpZ/ugLE4b2BdmlRNKrY6zLE4qFtRYQoS7axOyQX+4QUyN2m9bfm7urQmn+QRSXJwMO7X5kAJJLbkVGJFt9Pm9VXPwQVrK2aaqiXlpusj+7DfDw00OULmYMmZDTqXM0nUVLxj13z0LhMQoQhhNG8utdUn4uKOFceliTZ/xiP+A54GnX9620641bqw3ctfh9NNXPsTEK8hAUD7FDqUhVntHmoEYYEHq8X1tHHZYP49/f2iezTiE8AUaoZo42/jIWQIKohOGNUib2hEqMkW8NsR8vPihvNuqPc0zKZcl6359YFQdjiiW8kCRD/rsDOr9v1eYLFZKYloFyzFqEgj+jcG/V47elOjShJ5CCPwatXwP6HIloVwtgygFsnOFmCg6Ojoivfoz8Nw1qxFwg5OU2cq/1WbWNELKnaFg4eUWCAIJ/3ZIJsEPkgemZxGhE+hdiNn9dkQYBJs1kx2BxdIkJmQ9vJSKkrMz6lTxZM3IJ9mhmKS6zYdU1ppeAao0/ayte997DQParb/AHLN79g0iW1ad0z8ir5jAl0q3a+UZPTSa4YiSqC2PZ/gfxG5wvL2mKmeKowG0RXjmEp5iNxrni+T/HRLZOoH7y0DQ24nMCPg",
  "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRGHsL0Ccm0ELINFZ2IaBhKaeWnVuh0o6nZLCioCn9xpSADzwIS5VCWO+1eVXT2atJOyf7FYlpB0/JA3Us+aQtekuIkHu/zBXijORZ4ClF4+sF3cSTNg6gY/+6iwLK/zs3bMg+GeJrcI6vXfs95Shxlb2Rd5GRT2/2yBmR6Zkf5QwMJuptUHWtM26WY7/xlkEKGFYDZVqOSylusiOzSALa815zC dunesCiHoJNLBEKMlaZZQOk57/+OYoU5zzTaEgLhyvNFHSyAlyLQ3SGFtVHAaJZHSmmSPyJowCOB+92Gkk6SWVMsk6FbU8QJWFtlhzV/W/gZ7WzUlS/AKgN0th9/cq20ToFkW7X9c+rtYavufmuieqFhXgaMD8AGsoN9QC/HzNC9D1nydPfFYEUr9BHVy2nF5gM58Y59r2rT8pLPARIkUp8g+5DLhyW0tdZFZ1305o4AHCayZnp5rjcU2Xi/c1Qf/djBGakmijlMs4aMzKJYD0c4Q8jdI7sNyd876K2wRD+L6KeD2QB3PtCS4P7BWAl5gh5CJ6ZBrwcaKXZqcSjEwm52MqVCgYZdapAaNYUy/QndttjLOG0wxxwuX1hIhMjPnIKZR1kwnqD5EqlHpilrnojRZvjVGN4zEKmilS8rNstt4HHs/D849W+Q6LRVWiWMs0cT2IugrX+Skxd8En7Gq52UEmuVBrSTpN+UpIu20NsVb9lsvuYh3XO441606tOEY2eKcZJdTtqrOTNqbbTk0zVn1yhbOCvmfctBNDhTwaC5QMi0P9wjU5XI9SBtkdQLizc5oqpoiHeqgb8+aJHVLcbgIJ/KLZKtRWFDfzRNM02Csx4etUUapVd2NA/L0oMs/O5T9sVj9FBJ7q99GWr3PVmxJb36mHZLXC4k1gGN9swE0LtzYsUdT5tUo9ri/hS3W/SM+F1p4Kh4QIgRcG3ciIHGN44bnDh3HDCz0fDnzKYw0bclMxZPctEyJ5gEOPF6OAkjD9dEaRGq/tEPf1k9Aub+v2dEjnfrYWAm4E5Zfhs2Xh0CT0k+SzhgKd0K/46ChJ20G5+blwpIvahvTVS68+aVIX6CwXs4tcVx6FnmVsMOOkIasfaqQLZYbNBkuLoZnQAq4j8yRekrQ=="
]

export default async function (msg, { riz, id, reply }) {
  try {
    const messagePayload = {
      messageContextInfo: {
        deviceListMetadata: {},
        deviceListMetadataVersion: 2,
        botMetadata: {
          messageDisclaimerText: "",
          botResponseId: "calc-rich-bot-001",
          verificationMetadata: {
            proofs: [
              {
                version: 1,
                useCase: 1,
                signature: "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGFYeN5YRyad2+ZA==",
                certificateChain
              }
            ]
          }
        }
      },
      botForwardedMessage: {
        message: {
          richResponseMessage: {
            messageType: 1,
            submessages: [
              {
                messageType: 2,
                messageText: "AiRich Calculator"
              }
            ],
            unifiedResponse: {
              data: Buffer.from(JSON.stringify(payloadData)).toString("base64")
            },
            contextInfo: {
              forwardingScore: 1,
              isForwarded: true,
              forwardedAiBotMessageInfo: {
                botJid: "867051314767696@bot"
              },
              forwardOrigin: 4
            }
          }
        }
      }
    }

    const socket = riz || global.conn
    const targetChat = id || msg.key?.remoteJid
    return await socket.relayMessage(targetChat, messagePayload, {})
  } catch (err) {
    return reply(`Gagal mengirim AiRich: ${err.message}`)
  }
}
