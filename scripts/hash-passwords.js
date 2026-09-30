const bcrypt = require('bcrypt');

const credentials = [
  { email: 'ak45ashokkumar@gmail.com', password: 'WG@Aka5#Rx93' },
  { email: 'srisaigopi31@gmail.com', password: 'WG@Sri7!Qp46' },
  { email: 'kumarrk23dev@gmail.com', password: 'WG@Kum2$Yx85' },
  { email: 'mkrv0617@gmail.com', password: 'WG@Mkr6#Ln38' },
  { email: 'lakshmipriya.srbe@gmail.com', password: 'WG@Lak4!Qz71' },
  { email: 'muthuselvip04@gmail.com', password: 'WG@Mut9$Kr26' },
  { email: 'sgssubhashini@gmail.com', password: 'WG@Sgs5#Wp84' },
  { email: 'devisudalai2003@gmail.com', password: 'WG@Dev8!Mx39' },
  { email: 'jsmareeswaran47@gmail.com', password: 'WG@Jsm3$Qn67' },
  { email: 'mfvat.vicky@gmail.com', password: 'WG@Mfv7#Rt42' },
  { email: 'geethagurumoorthy93@gmail.com', password: 'WG@Gee6!Xp58' },
  { email: 'umarajofficial@gmail.com', password: 'WG@Uma8#Lp47' },
  { email: 'sujac1991@gmail.com', password: 'WG@Suj4!Nx82' },
  { email: 'navenn919@gmail.com', password: 'WG@Nav6$Qr31' },
  { email: 'prabhu1996prabha@gmail.com', password: 'WG@Pra9#Tk54' },
  { email: 'nandhakumar19052005@gmail.com', password: 'WG@Nan3!Vz76' },
  { email: 'pandiselvam.pps@gmail.com', password: 'WG@Pan8$Hm25' }
];

async function main() {
  const results = [];
  for (const item of credentials) {
    const hash = await bcrypt.hash(item.password, 10);
    const verify = await bcrypt.compare(item.password, hash);
    results.push({
      email: item.email,
      plainPassword: item.password,
      bcryptHash: hash,
      verified: verify
    });
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
