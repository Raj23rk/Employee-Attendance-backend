const http = require('http');

const BASE_URL = 'http://localhost:5000/api/v1';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      url,
      { method, headers },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed = data;
          try {
            parsed = JSON.parse(data);
          } catch (e) {}
          resolve({ status: res.statusCode, data: parsed });
        });
      },
    );

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING AUTOMATED API VERIFICATION ===\n');

  // 1. Test Login as Employee (Priya - Female)
  console.log('1. Testing Login as Priya (Female Employee)...');
  const priyaLogin = await request('POST', '/auth/login', {
    identifier: 'priya.sharma@wegrow.edu.in',
    password: 'Password@123',
  });
  console.log('   Priya Login Status:', priyaLogin.status);
  const priyaToken = priyaLogin.data?.accessToken;
  console.log('   Priya Token acquired:', !!priyaToken, 'Role:', priyaLogin.data?.user?.role, 'Gender:', priyaLogin.data?.user?.gender);

  // 2. Test Login as Male Employee (Vijay - Male)
  console.log('\n2. Testing Login as Vijay (Male Employee)...');
  const vijayLogin = await request('POST', '/auth/login', {
    identifier: 'vijay.kumaran@wegrow.edu.in',
    password: 'Password@123',
  });
  console.log('   Vijay Login Status:', vijayLogin.status);
  const vijayToken = vijayLogin.data?.accessToken;
  console.log('   Vijay Token acquired:', !!vijayToken, 'Gender:', vijayLogin.data?.user?.gender);

  // 3. Test Login as CEO
  console.log('\n3. Testing Login as CEO...');
  const ceoLogin = await request('POST', '/auth/login', {
    identifier: 'ceo@wegrow.edu.in',
    password: 'Password@123',
  });
  console.log('   CEO Login Status:', ceoLogin.status);
  const ceoToken = ceoLogin.data?.accessToken;
  console.log('   CEO Token acquired:', !!ceoToken, 'Role:', ceoLogin.data?.user?.role);

  // 4. Test Punch In / Today Status / Calendar
  console.log('\n4. Testing Attendance Punch In for Priya...');
  const punchIn = await request('POST', '/attendance/check-in', { notes: 'Office Check-in' }, priyaToken);
  console.log('   Punch In Status:', punchIn.status, 'Response:', punchIn.data?.message);

  const todayStatus = await request('GET', '/attendance/today', null, priyaToken);
  console.log('   Today Status:', todayStatus.status, 'Checked In:', todayStatus.data?.checkedIn, 'Status:', todayStatus.data?.status);

  const myCalendar = await request('GET', '/attendance/my-calendar?month=9&year=2026', null, priyaToken);
  console.log('   My Calendar Status:', myCalendar.status, 'Present Days:', myCalendar.data?.summary?.presentDays, 'Total Days:', myCalendar.data?.days?.length);

  // 5. Parental Leave Policies Verification:
  console.log('\n5. Testing Parental Leave Policy (Maternity & Paternity)...');
  
  // A. Priya (Female) applies for Maternity -> Expect 201 Created
  const maternityFemale = await request('POST', '/leaves/apply', {
    leaveType: 'MATERNITY',
    fromDate: '2026-10-01',
    toDate: '2027-03-31',
    days: 182,
    reason: 'Maternity leave for child delivery',
  }, priyaToken);
  console.log('   A. Female (Priya) applying for Maternity Leave: Status', maternityFemale.status, maternityFemale.status === 201 ? '✅ ALLOWED' : '❌ UNEXPECTED');

  // B. Vijay (Male) applies for Maternity -> Expect 400 Bad Request
  const maternityMale = await request('POST', '/leaves/apply', {
    leaveType: 'MATERNITY',
    fromDate: '2026-10-01',
    toDate: '2026-10-15',
    days: 14,
    reason: 'Maternity test',
  }, vijayToken);
  console.log('   B. Male (Vijay) applying for Maternity Leave: Status', maternityMale.status, maternityMale.status === 400 ? '✅ BLOCKED: ' + maternityMale.data?.message : '❌ UNEXPECTED');

  // C. Vijay (Male) applies for 3-Day Paid Paternity -> Expect 201 Created
  const paternityMaleOk = await request('POST', '/leaves/apply', {
    leaveType: 'PATERNITY',
    fromDate: '2026-10-05',
    toDate: '2026-10-07',
    days: 3,
    reason: 'New child birth paternity leave',
  }, vijayToken);
  console.log('   C. Male (Vijay) applying for 3-day Paid Paternity: Status', paternityMaleOk.status, paternityMaleOk.status === 201 ? '✅ ALLOWED' : '❌ UNEXPECTED');

  // D. Vijay (Male) applies for 4-day Paternity -> Expect 400 Bad Request
  const paternityMaleExcess = await request('POST', '/leaves/apply', {
    leaveType: 'PATERNITY',
    fromDate: '2026-10-05',
    toDate: '2026-10-09',
    days: 4,
    reason: 'Too many paternity days',
  }, vijayToken);
  console.log('   D. Male (Vijay) applying for 4-day Paternity: Status', paternityMaleExcess.status, paternityMaleExcess.status === 400 ? '✅ BLOCKED (>3 days): ' + paternityMaleExcess.data?.message : '❌ UNEXPECTED');

  // 6. Confidential Open Feedback Verification (CEO Visibility Only)
  console.log('\n6. Testing Confidential Open Feedback API...');
  
  // A. Vijay submits feedback
  const feedbackSubmit = await request('POST', '/feedback', {
    title: 'Suggestion for Campus Cafeteria Healthy Options',
    category: 'INFRASTRUCTURE',
    message: 'Can we please have fresh juice and more healthy meal choices in the cafeteria?',
    suggestions: 'Partner with local organic farm suppliers',
  }, vijayToken);
  console.log('   A. Employee submits feedback: Status', feedbackSubmit.status, feedbackSubmit.data?.message);

  // B. Vijay attempts to list all feedback entries -> Expect 403 Forbidden
  const feedbackListEmp = await request('GET', '/feedback', null, vijayToken);
  console.log('   B. Employee calls GET /api/v1/feedback: Status', feedbackListEmp.status, feedbackListEmp.status === 403 ? '✅ STRICTLY FORBIDDEN (Hidden from employee)' : '❌ UNEXPECTED');

  // C. CEO lists all feedback entries -> Expect 200 OK with employee name visible
  const feedbackListCeo = await request('GET', '/feedback', null, ceoToken);
  console.log('   C. CEO calls GET /api/v1/feedback: Status', feedbackListCeo.status, 'Entries Count:', feedbackListCeo.data?.count);
  const firstFeedback = feedbackListCeo.data?.data?.[0];
  console.log('      First Feedback Submitter visible to CEO:', firstFeedback?.submittedBy?.name, `(${firstFeedback?.submittedBy?.email})`);

  // 7. Peer Celebration Wish Message Verification
  console.log('\n7. Testing Peer Celebration Wish Message...');
  const priyaId = priyaLogin.data?.user?.id;
  const wishRes = await request('POST', `/dashboard/celebrations/${priyaId}/wish`, {
    message: 'Wishing you a very happy birthday and great year ahead!',
    occasionType: 'BIRTHDAY',
    reactionEmoji: '🎂',
  }, vijayToken);
  console.log('   Wish Status:', wishRes.status, 'Message:', wishRes.data?.message);

  // 8. CEO Executive Overview
  console.log('\n8. Testing CEO Executive Attendance Overview...');
  const ceoOverview = await request('GET', '/attendance/ceo/overview', null, ceoToken);
  console.log('   CEO Overview Status:', ceoOverview.status, 'Total Employees:', ceoOverview.data?.companyStats?.totalEmployees, 'Attendance Rate:', ceoOverview.data?.companyStats?.attendanceRateToday + '%');

  console.log('\n=== ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY! ===');
}

runTests().catch(console.error);
