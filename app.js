// আপনার Web App URL সরাসরি যুক্ত করা হয়েছে
const API_URL = "https://script.google.com/macros/s/AKfycbxJZ-iviR2DMZCbBYL5Cz_lFJgvIFg1kFN4Bxjo9qs4jxwx0eSJK7UaDPgPOB8yu6ZERQ/exec";

let loggedInUser = null;
let crmData = { leads: [], users: [] };

async function login() {
  const u = document.getElementById('logUser').value;
  const p = document.getElementById('logPass').value;
  const msg = document.getElementById('logMsg');
  msg.innerText = "Signing in...";

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'login', username: u, password: p })
    });
    const result = await res.json();

    if (result.success) {
      loggedInUser = result.user;
      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('userNameBadge').innerText = loggedInUser.fullName;
      document.getElementById('profName').innerText = loggedInUser.fullName;
      document.getElementById('profUser').innerText = loggedInUser.username;
      document.getElementById('profRole').innerText = loggedInUser.role;
      refreshData();
    } else {
      msg.innerText = result.message;
    }
  } catch (err) {
    msg.innerText = "Connection Error!";
  }
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId).classList.remove('hidden');
  event.currentTarget.classList.add('active');
  document.getElementById('pageTitle').innerText = event.currentTarget.innerText.trim();
}

async function refreshData() {
  try {
    const res = await fetch(`${API_URL}?action=getData`);
    crmData = await res.json();
    renderAll();
  } catch (err) {
    console.error("Data load error:", err);
  }
}

function renderAll() {
  const leads = crmData.leads || [];
  const users = crmData.users || [];

  const todayStr = new Date().toISOString().slice(0, 10);
  const total = leads.length;
  const todayCount = leads.filter(l => String(l.timestamp).includes(todayStr)).length;
  const newCount = leads.filter(l => l.status === 'New').length;
  const bookedCount = leads.filter(l => l.status === 'Booked' || l.status === 'Won').length;

  document.getElementById('valTotal').innerText = total;
  document.getElementById('valToday').innerText = todayCount;
  document.getElementById('valNew').innerText = newCount;
  document.getElementById('valBooked').innerText = bookedCount;

  const summary = {};
  users.forEach(u => { summary[u.username] = { assigned: 0, booked: 0 }; });
  leads.forEach(l => {
    if (!summary[l.assignedTo]) summary[l.assignedTo] = { assigned: 0, booked: 0 };
    summary[l.assignedTo].assigned++;
    if (l.status === 'Booked' || l.status === 'Won') summary[l.assignedTo].booked++;
  });

  const sBody = document.getElementById('teamSummaryBody');
  sBody.innerHTML = '';
  for (const uKey in summary) {
    sBody.innerHTML += `<tr>
      <td>${uKey}</td>
      <td>${summary[uKey].assigned}</td>
      <td>${summary[uKey].booked}</td>
    </tr>`;
  }

  const aSel = document.getElementById('fAssign');
  aSel.innerHTML = '';
  users.forEach(u => {
    aSel.innerHTML += `<option value="${u.username}">${u.fullName} (${u.username})</option>`;
  });

  const lBody = document.getElementById('allLeadsBody');
  lBody.innerHTML = '';
  leads.forEach(l => {
    lBody.innerHTML += `<tr>
      <td><b>${l.id}</b></td>
      <td>${l.timestamp}</td>
      <td>${l.customer}</td>
      <td>${l.phone}</td>
      <td>${l.city}</td>
      <td>${l.service}</td>
      <td>${l.assignedTo}</td>
      <td><span class="badge ${l.status === 'Booked' ? 'badge-booked' : 'badge-new'}">${l.status}</span></td>
    </tr>`;
  });

  const uBody = document.getElementById('usersListBody');
  uBody.innerHTML = '';
  users.forEach(u => {
    uBody.innerHTML += `<tr><td>${u.fullName}</td><td>${u.username}</td><td>${u.role}</td></tr>`;
  });
}

async function saveLead() {
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerText = "Submitting...";

  const payload = {
    customer: document.getElementById('fName').value,
    phone: document.getElementById('fPhone').value,
    city: document.getElementById('fCity').value,
    service: document.getElementById('fService').value,
    assignedTo: document.getElementById('fAssign').value,
    notes: document.getElementById('fNotes').value
  };

  if (!payload.customer || !payload.phone) {
    alert("Please enter Name and Phone!");
    btn.disabled = false;
    btn.innerText = "Submit Lead";
    return;
  }

  try {
    await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'addLead', lead: payload })
    });
    
    alert("Lead submitted successfully!");
    document.getElementById('fName').value = '';
    document.getElementById('fPhone').value = '';
    document.getElementById('fCity').value = '';
    document.getElementById('fService').value = '';
    document.getElementById('fNotes').value = '';
    refreshData();
    switchTab('tab-dashboard');
  } catch (err) {
    alert("Error submitting lead!");
  } finally {
    btn.disabled = false;
    btn.innerText = "Submit Lead";
  }
}

function logout() {
  loggedInUser = null;
  document.getElementById('loginScreen').classList.remove('hidden');
}
