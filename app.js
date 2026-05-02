// ── State ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'budget_txs_v1';
let transactions = [];
let selectedType = 'expense';
let activeFilter = 'all';

const CATEGORY_META = {
  Food:          { icon: '🍔', color: '#f59e0b' },
  Transport:     { icon: '🚗', color: '#3b82f6' },
  Housing:       { icon: '🏠', color: '#8b5cf6' },
  Health:        { icon: '💊', color: '#ec4899' },
  Entertainment: { icon: '🎮', color: '#06b6d4' },
  Shopping:      { icon: '🛍️', color: '#f97316' },
  Utilities:     { icon: '💡', color: '#eab308' },
  Salary:        { icon: '💼', color: '#34d399' },
  Other:         { icon: '📦', color: '#94a3b8' },
};

// ── Persistence ────────────────────────────────────────────────────────────
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    transactions = raw ? JSON.parse(raw) : [];
  } catch {
    transactions = [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

// ── Type Toggle ────────────────────────────────────────────────────────────
function setType(type) {
  selectedType = type;
  document.getElementById('btn-expense').className =
    'type-btn' + (type === 'expense' ? ' active-expense' : '');
  document.getElementById('btn-income').className =
    'type-btn' + (type === 'income' ? ' active-income' : '');
}

// ── Add Transaction ────────────────────────────────────────────────────────
function addTransaction() {
  const desc   = document.getElementById('desc').value.trim();
  const amount = parseFloat(document.getElementById('amount').value);
  const cat    = document.getElementById('category').value;

  if (!desc)               { showToast('Please enter a description.'); return; }
  if (!amount || amount <= 0) { showToast('Please enter a valid amount.'); return; }

  const tx = {
    id:       Date.now(),
    desc,
    amount,
    category: cat,
    type:     selectedType,
    date:     new Date().toISOString(),
  };

  transactions.unshift(tx);
  save();
  render();

  document.getElementById('desc').value   = '';
  document.getElementById('amount').value = '';
  showToast('Transaction added ✓');
}

// ── Delete ─────────────────────────────────────────────────────────────────
function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  save();
  render();
  showToast('Transaction removed.');
}

function clearAll() {
  if (!transactions.length) { showToast('Nothing to clear.'); return; }
  if (!confirm('Delete all transactions?')) return;
  transactions = [];
  save();
  render();
  showToast('All transactions cleared.');
}

// ── Filter ─────────────────────────────────────────────────────────────────
function setFilter(filter, btn) {
  activeFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderList();
}

// ── Render ─────────────────────────────────────────────────────────────────
function render() {
  renderSummary();
  renderChart();
  renderList();
}

function fmt(n) {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function renderSummary() {
  const income  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  document.getElementById('balance').textContent       = fmt(balance);
  document.getElementById('total-income').textContent  = fmt(income);
  document.getElementById('total-expense').textContent = fmt(expense);

  const balEl = document.getElementById('balance');
  balEl.style.color = balance < 0 ? 'var(--red)' : balance > 0 ? 'var(--green)' : 'var(--accent)';
}

// ── Chart instance ─────────────────────────────────────────────────────────
let pieChart = null;

function renderChart() {
  const expenses = transactions.filter(t => t.type === 'expense');
  const emptyEl  = document.getElementById('chart-empty');
  const pieWrap  = document.getElementById('pie-wrap');
  const legendEl = document.getElementById('pie-legend');

  if (!expenses.length) {
    emptyEl.style.display  = '';
    pieWrap.style.display  = 'none';
    legendEl.innerHTML     = '';
    if (pieChart) { pieChart.destroy(); pieChart = null; }
    return;
  }

  emptyEl.style.display = 'none';
  pieWrap.style.display = '';

  // Aggregate by category
  const totals = {};
  expenses.forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });

  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const total  = sorted.reduce((s, [, v]) => s + v, 0);
  const labels = sorted.map(([cat])   => cat);
  const data   = sorted.map(([, amt]) => amt);
  const colors = sorted.map(([cat])   => (CATEGORY_META[cat] || CATEGORY_META.Other).color);

  if (pieChart) {
    // Update existing chart in-place — no flicker
    pieChart.data.labels          = labels;
    pieChart.data.datasets[0].data            = data;
    pieChart.data.datasets[0].backgroundColor = colors;
    pieChart.data.datasets[0].borderColor     = colors.map(c => c + '99');
    pieChart.update();
  } else {
    const ctx = document.getElementById('pie-chart').getContext('2d');
    pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor:     colors.map(c => c + '99'),
          borderWidth:     2,
          hoverOffset:     8,
        }],
      },
      options: {
        cutout: '62%',
        animation: { animateRotate: true, duration: 500 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const pct = (ctx.parsed / total * 100).toFixed(1);
                return ` ${fmt(ctx.parsed)}  (${pct}%)`;
              },
            },
            backgroundColor: '#1a1d27',
            borderColor:     '#2e3250',
            borderWidth:     1,
            titleColor:      '#e2e8f0',
            bodyColor:       '#8892b0',
            padding:         10,
          },
        },
      },
    });
  }

  // Render custom legend
  legendEl.innerHTML = sorted.map(([cat, amt]) => {
    const meta = CATEGORY_META[cat] || CATEGORY_META.Other;
    const pct  = (amt / total * 100).toFixed(1);
    return `
      <li>
        <span class="legend-swatch" style="background:${meta.color}"></span>
        <span class="legend-label">${meta.icon} ${cat}</span>
        <span class="legend-pct">${pct}%</span>
        <span class="legend-amt">${fmt(amt)}</span>
      </li>`;
  }).join('');
}

function renderList() {
  const list = document.getElementById('tx-list');
  const filtered = activeFilter === 'all'
    ? transactions
    : transactions.filter(t => t.type === activeFilter);

  if (!filtered.length) {
    list.innerHTML = '<p class="tx-empty">No transactions yet.</p>';
    return;
  }

  list.innerHTML = filtered.map(t => {
    const meta = CATEGORY_META[t.category] || CATEGORY_META.Other;
    const date = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const sign = t.type === 'income' ? '+' : '−';
    return `
      <div class="tx-item">
        <div class="tx-icon" style="background:${meta.color}22;color:${meta.color}">${meta.icon}</div>
        <div class="tx-info">
          <div class="tx-desc">${escHtml(t.desc)}</div>
          <div class="tx-meta">${t.category} · ${date}</div>
        </div>
        <div class="tx-amount ${t.type}">${sign}${fmt(t.amount)}</div>
        <button class="tx-delete" onclick="deleteTransaction(${t.id})" aria-label="Delete transaction">✕</button>
      </div>`;
  }).join('');
}

// ── Helpers ────────────────────────────────────────────────────────────────
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

// ── Enter key shortcut ─────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.target.id === 'desc' || e.target.id === 'amount')) {
    addTransaction();
  }
});

// ── Init ───────────────────────────────────────────────────────────────────
load();
render();
