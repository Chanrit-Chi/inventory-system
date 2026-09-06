<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>KC Shop — Telegram Portal</title>
    <!-- Telegram WebApp SDK -->
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        kc: {
                            50: '#fffbeb',
                            100: '#fef3c7',
                            200: '#fde68a',
                            500: '#f59e0b',
                            600: '#d97706',
                            700: '#b45309',
                        }
                    }
                }
            }
        }
    </script>
    <style>
        :root {
            --bg-color: var(--tg-theme-bg-color, #0f172a);
            --text-color: var(--tg-theme-text-color, #f8fafc);
            --hint-color: var(--tg-theme-hint-color, #94a3b8);
            --button-color: var(--tg-theme-button-color, #f59e0b);
            --button-text-color: var(--tg-theme-button-text-color, #000000);
            --secondary-bg-color: var(--tg-theme-secondary-bg-color, #1e293b);
        }
        body {
            background-color: var(--bg-color);
            color: var(--text-color);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            min-height: 100vh;
        }
        .card-bg {
            background-color: var(--secondary-bg-color);
        }
        .nav-active {
            color: #f59e0b;
        }
        /* Hide scrollbars */
        ::-webkit-scrollbar {
            display: none;
        }
    </style>
</head>
<body class="bg-slate-900 text-slate-100 flex flex-col justify-between min-h-screen select-none pb-20">

    <!-- Top Navigation Bar -->
    <header class="p-4 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur sticky top-0 z-20 flex items-center justify-between">
        <div class="flex items-center space-x-2.5">
            <div class="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center ring-1 ring-amber-500/30">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
                </svg>
            </div>
            <div>
                <h1 class="text-sm font-bold text-white leading-none">KC Shop</h1>
                <p id="header-subtitle" class="text-[10px] text-slate-400 font-medium">Inventory & POS Portal</p>
            </div>
        </div>
        <div class="flex items-center space-x-2">
            <button onclick="refreshCurrentTab()" class="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition active:scale-95" title="Refresh">
                <svg id="refresh-icon" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
            </button>
            <button onclick="closeApp()" class="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-medium hover:bg-slate-700 transition">
                Close
            </button>
        </div>
    </header>

    <!-- MAIN CONTAINER -->
    <main class="flex-1 p-4 max-w-lg w-full mx-auto space-y-4">

        <!-- 0. LOADING SCREEN -->
        <div id="view-loading" class="py-20 text-center space-y-3">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-3 border-amber-500 border-t-transparent"></div>
            <p class="text-xs text-slate-400">Loading KC Shop portal...</p>
        </div>

        <!-- 0. LOGIN VIEW (If not linked) -->
        <div id="view-login" class="hidden space-y-4 py-4">
            <div class="text-center space-y-1">
                <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 mb-1 ring-2 ring-amber-500/30">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>
                </div>
                <h2 class="text-lg font-bold text-white">Connect Staff Account</h2>
                <p class="text-xs text-slate-400">Log in with your KC Shop credentials to link Telegram.</p>
            </div>

            <div id="login-error" class="hidden p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                <span id="login-error-text"></span>
            </div>

            <form onsubmit="handleLogin(event)" class="card-bg rounded-2xl p-5 space-y-3 ring-1 ring-white/10 shadow-xl">
                <div class="space-y-1">
                    <label class="text-xs text-slate-300 font-medium block">Email or Username</label>
                    <input type="text" id="login-input" required autocomplete="username" placeholder="admin@inventory.local"
                        class="w-full px-3 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition">
                </div>
                <div class="space-y-1">
                    <label class="text-xs text-slate-300 font-medium block">Password</label>
                    <input type="password" id="password-input" required autocomplete="current-password" placeholder="••••••••"
                        class="w-full px-3 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition">
                </div>
                <button type="submit" id="btn-login-submit" class="w-full py-3 px-4 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition active:scale-[0.98] shadow-lg shadow-amber-500/20">
                    Connect to KC Shop
                </button>
            </form>
        </div>

        <!-- ============================================================ -->
        <!-- TAB 1: 📊 FLASH DASHBOARD VIEW -->
        <!-- ============================================================ -->
        <div id="tab-dashboard" class="hidden space-y-4">
            <!-- Revenue Card -->
            <div class="card-bg rounded-2xl p-5 ring-1 ring-white/10 shadow-xl space-y-3 relative overflow-hidden">
                <div class="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-amber-500/10 blur-2xl"></div>
                <div class="flex items-center justify-between">
                    <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Today's Net Revenue</span>
                    <span id="dash-role-badge" class="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"></span>
                </div>
                <div>
                    <h2 id="dash-revenue" class="text-3xl font-black tracking-tight text-white">$0.00</h2>
                    <p id="dash-user-scope" class="text-[11px] text-slate-400 mt-0.5">Store-wide Completed Sales</p>
                </div>

                <!-- 3 Quick KPI Tiles -->
                <div class="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
                    <div class="bg-slate-800/60 rounded-xl p-2.5 text-center">
                        <p class="text-[10px] text-slate-400 font-medium">Orders</p>
                        <p id="dash-orders-count" class="text-base font-bold text-white mt-0.5">0</p>
                    </div>
                    <div class="bg-slate-800/60 rounded-xl p-2.5 text-center">
                        <p class="text-[10px] text-slate-400 font-medium">Avg Basket</p>
                        <p id="dash-avg-basket" class="text-base font-bold text-white mt-0.5">$0.00</p>
                    </div>
                    <div onclick="switchTab('scanner')" class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-center cursor-pointer active:scale-95 transition">
                        <p class="text-[10px] text-amber-400 font-medium">Low Stock</p>
                        <p id="dash-low-stock-count" class="text-base font-bold text-amber-300 mt-0.5">0</p>
                    </div>
                </div>
            </div>

            <!-- Payment Split Bar -->
            <div class="card-bg rounded-2xl p-4 ring-1 ring-white/10 space-y-2">
                <div class="flex items-center justify-between text-xs">
                    <span class="text-slate-300 font-semibold">Payment Methods Today</span>
                    <span id="dash-digital-pct" class="font-bold text-amber-400">0% Digital</span>
                </div>
                <div class="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
                    <div id="bar-digital" class="bg-amber-500 h-full transition-all duration-500" style="width: 0%"></div>
                    <div id="bar-cash" class="bg-emerald-500 h-full transition-all duration-500" style="width: 100%"></div>
                </div>
                <div class="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                    <span class="flex items-center"><span class="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span>Cash: <strong id="dash-cash-count" class="text-slate-200 ml-1">0</strong></span>
                    <span class="flex items-center"><span class="w-2 h-2 rounded-full bg-amber-500 mr-1.5"></span>Digital / ABA: <strong id="dash-digital-count" class="text-slate-200 ml-1">0</strong></span>
                </div>
            </div>

            <!-- Urgent Low Stock Alerts List -->
            <div class="card-bg rounded-2xl p-4 ring-1 ring-white/10 space-y-3">
                <div class="flex items-center justify-between">
                    <h3 class="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center">
                        <svg class="w-4 h-4 text-amber-400 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                        Urgent Reorder Alert
                    </h3>
                    <span id="urgent-badge-count" class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">0 Items</span>
                </div>
                <div id="urgent-items-list" class="space-y-2">
                    <p class="text-xs text-slate-500 text-center py-2">No critical low stock items right now.</p>
                </div>
            </div>

            <!-- Top Selling Items -->
            <div class="card-bg rounded-2xl p-4 ring-1 ring-white/10 space-y-2.5">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-300">Top Sellers Today</h3>
                <div id="top-items-list" class="space-y-1.5">
                    <p class="text-xs text-slate-500 text-center py-2">No orders recorded yet today.</p>
                </div>
            </div>
        </div>

        <!-- ============================================================ -->
        <!-- TAB 2: 🔍 POCKET BARCODE SCANNER & STOCK CHECKER -->
        <!-- ============================================================ -->
        <div id="tab-scanner" class="hidden space-y-4">
            
            <!-- Camera Scanner CTA Card -->
            <div class="card-bg rounded-2xl p-5 ring-1 ring-white/10 shadow-xl text-center space-y-3">
                <button onclick="openTelegramScanner()" class="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-base shadow-lg shadow-amber-500/20 active:scale-[0.98] transition flex items-center justify-center space-x-2.5">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
                    </svg>
                    <span>Scan Item Barcode</span>
                </button>
                <p class="text-[11px] text-slate-400">Uses your phone camera to scan physical 1D/2D barcodes instantly.</p>
            </div>

            <!-- Manual Search Input -->
            <form onsubmit="handleManualSearch(event)" class="flex space-x-2">
                <input type="text" id="scan-manual-input" placeholder="Enter barcode or SKU (e.g. TSHIRT-S-BLACK)"
                    class="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition">
                <button type="submit" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs border border-slate-700 transition active:scale-95">
                    Search
                </button>
            </form>

            <!-- Scan Loading Spinner -->
            <div id="scan-loading" class="hidden py-8 text-center space-y-2">
                <div class="inline-block animate-spin rounded-full h-6 w-6 border-2 border-amber-500 border-t-transparent"></div>
                <p class="text-xs text-slate-400">Looking up product...</p>
            </div>

            <!-- Scan Error Box -->
            <div id="scan-error" class="hidden p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
                <svg class="w-4 h-4 flex-shrink-0 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span id="scan-error-text"></span>
            </div>

            <!-- Scanned Product Detail Card -->
            <div id="scan-result-card" class="hidden card-bg rounded-2xl p-5 ring-1 ring-white/10 shadow-2xl space-y-4">
                <div class="flex items-start justify-between">
                    <div>
                        <span id="res-badge-status" class="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">In Stock</span>
                        <h3 id="res-product-name" class="text-base font-bold text-white mt-1"></h3>
                        <p id="res-sku" class="text-xs text-slate-400 font-mono"></p>
                    </div>
                    <div class="text-right">
                        <p class="text-[10px] text-slate-400 font-medium">Retail Price</p>
                        <p id="res-retail-price" class="text-lg font-black text-amber-400">$0.00</p>
                        <p id="res-cost-price" class="text-[10px] text-slate-500 font-mono hidden"></p>
                    </div>
                </div>

                <!-- Stock Counter Box -->
                <div class="bg-slate-800/80 rounded-xl p-3.5 flex items-center justify-between border border-slate-700/60">
                    <div>
                        <p class="text-[10px] text-slate-400 uppercase font-semibold">Quantity on Hand</p>
                        <div class="flex items-baseline space-x-2 mt-0.5">
                            <span id="res-stock-qty" class="text-2xl font-black text-white">0</span>
                            <span class="text-xs text-slate-400">units</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-[10px] text-slate-400 uppercase font-semibold">Reorder Level</p>
                        <p id="res-reorder-level" class="text-sm font-bold text-slate-300 mt-0.5">0 units</p>
                    </div>
                </div>

                <!-- Quick Stock Adjustment Section (Only visible to Managers/Admins) -->
                <div id="res-adjust-section" class="pt-2 border-t border-slate-800 space-y-3">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-bold text-slate-300">Quick Stock Adjustment</span>
                        <span class="text-[10px] text-amber-400 font-medium">Manager Mode</span>
                    </div>

                    <!-- Quantity Stepper -->
                    <div class="flex items-center justify-center space-x-3">
                        <button onclick="stepAdjustment(-5)" class="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-sm border border-slate-700 active:scale-95">-5</button>
                        <button onclick="stepAdjustment(-1)" class="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-base border border-slate-700 active:scale-95">-1</button>
                        <input type="number" id="adjust-new-qty" min="0" class="w-20 text-center py-2 rounded-xl bg-slate-800 border border-slate-600 text-lg font-black text-amber-400 focus:outline-none focus:border-amber-500">
                        <button onclick="stepAdjustment(+1)" class="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-base border border-slate-700 active:scale-95">+1</button>
                        <button onclick="stepAdjustment(+5)" class="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-sm border border-slate-700 active:scale-95">+5</button>
                    </div>

                    <!-- Reason Dropdown -->
                    <div class="space-y-1">
                        <label class="text-[11px] text-slate-400 font-medium block">Reason for adjustment</label>
                        <select id="adjust-reason" class="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500">
                            <option value="Audit">Inventory Audit / Count Correction</option>
                            <option value="Damaged">Damaged Goods on Floor</option>
                            <option value="Restock">Manual Restock Addition</option>
                            <option value="Return">Customer Return / Exchange</option>
                            <option value="Shrinkage">Shrinkage / Missing Item</option>
                        </select>
                    </div>

                    <button onclick="submitStockAdjustment()" id="btn-save-adjust" class="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs active:scale-[0.98] transition shadow-md shadow-amber-500/10 flex items-center justify-center space-x-2">
                        <span>Save Stock Count</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- ============================================================ -->
        <!-- TAB 3: 👤 ACCOUNT VIEW -->
        <!-- ============================================================ -->
        <div id="tab-account" class="hidden space-y-4">
            <div class="card-bg rounded-2xl p-5 ring-1 ring-white/10 shadow-xl space-y-4">
                <div class="flex items-center justify-between border-b border-white/10 pb-3">
                    <div class="flex items-center space-x-2">
                        <span class="flex h-2.5 w-2.5 relative">
                            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <span class="text-xs font-bold uppercase tracking-wider text-emerald-400">Connected</span>
                    </div>
                    <span id="account-role-badge" class="text-xs px-2.5 py-0.5 rounded-full font-bold"></span>
                </div>

                <div class="space-y-1">
                    <p class="text-xs text-slate-400 uppercase font-medium">Logged in Staff</p>
                    <p id="account-name" class="text-lg font-bold text-white"></p>
                    <p id="account-email" class="text-xs text-slate-400 font-mono"></p>
                    <p id="account-tg-user" class="text-xs text-amber-400 pt-1 font-medium"></p>
                </div>

                <div class="bg-white/5 rounded-xl p-3 text-xs text-slate-300 space-y-1.5 border border-white/5">
                    <div class="flex items-center font-semibold text-amber-300">
                        <svg class="w-4 h-4 mr-1 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                        </svg>
                        Notification Channel
                    </div>
                    <p id="account-role-desc" class="text-slate-400 text-xs"></p>
                </div>

                <div class="pt-2 space-y-2">
                    <button onclick="unlinkAccount()" id="btn-account-unlink" class="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition">
                        Disconnect Telegram Account
                    </button>
                </div>
            </div>
        </div>

    </main>

    <!-- PERSISTENT BOTTOM NAVIGATION BAR -->
    <nav id="bottom-nav" class="hidden fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-slate-900/95 backdrop-blur border-t border-slate-800 z-30 px-6 py-2 flex justify-around items-center">
        <!-- Dashboard Tab Button -->
        <button onclick="switchTab('dashboard')" id="nav-btn-dashboard" class="flex flex-col items-center space-y-1 text-xs font-semibold text-slate-400 transition nav-active">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
            <span>Dashboard</span>
        </button>

        <!-- Scanner Tab Button -->
        <button onclick="switchTab('scanner')" id="nav-btn-scanner" class="flex flex-col items-center space-y-1 text-xs font-semibold text-slate-400 transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
            </svg>
            <span>Scanner</span>
        </button>

        <!-- Account Tab Button -->
        <button onclick="switchTab('account')" id="nav-btn-account" class="flex flex-col items-center space-y-1 text-xs font-semibold text-slate-400 transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
            <span>Account</span>
        </button>
    </nav>

    <!-- SCRIPTS -->
    <script>
        const tg = window.Telegram?.WebApp;
        if (tg) {
            tg.ready();
            tg.expand();
        }

        const initData = tg?.initData || '';
        const user = tg?.initDataUnsafe?.user;
        let currentTab = 'dashboard';
        let currentScannedVariant = null;

        const ROLE_BADGES = {
            'SUPER_ADMIN': 'bg-purple-500/20 text-purple-300 border border-purple-500/40',
            'ADMIN': 'bg-blue-500/20 text-blue-300 border border-blue-500/40',
            'MANAGER': 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
            'SELLER': 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
        };

        const ROLE_DESCRIPTIONS = {
            'SUPER_ADMIN': 'Full system alerts: low stock, real-time sales, restocks & audit logs.',
            'ADMIN': 'Store management alerts: low stock, sales, inventory movements & restocks.',
            'MANAGER': 'Branch operations: low stock threshold alerts and inbound restock receipts.',
            'SELLER': 'Personal POS sales: real-time notifications for orders you checkout.',
        };

        function switchTab(tab) {
            currentTab = tab;
            if (tg?.HapticFeedback) {
                tg.HapticFeedback.selectionChanged();
            }

            // Hide all tab views
            ['dashboard', 'scanner', 'account'].forEach(t => {
                document.getElementById(`tab-${t}`).classList.add('hidden');
                document.getElementById(`nav-btn-${t}`).classList.remove('nav-active', 'text-amber-400');
                document.getElementById(`nav-btn-${t}`).classList.add('text-slate-400');
            });

            // Show selected tab view
            document.getElementById(`tab-${tab}`).classList.remove('hidden');
            const activeBtn = document.getElementById(`nav-btn-${tab}`);
            activeBtn.classList.add('nav-active', 'text-amber-400');
            activeBtn.classList.remove('text-slate-400');

            if (tab === 'dashboard') {
                loadDashboardData();
            }
        }

        function refreshCurrentTab() {
            const icon = document.getElementById('refresh-icon');
            icon.classList.add('animate-spin');
            setTimeout(() => icon.classList.remove('animate-spin'), 1000);

            if (currentTab === 'dashboard') {
                loadDashboardData();
            } else if (currentTab === 'account') {
                checkStatus();
            }
        }

        // 1. Initial Status Check
        async function checkStatus() {
            try {
                const res = await fetch('/api/v1/telegram/miniapp/status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ init_data: initData })
                });
                const json = await res.json();

                document.getElementById('view-loading').classList.add('hidden');

                if (json.success && json.linked) {
                    renderAccount(json.data);
                    document.getElementById('view-login').classList.add('hidden');
                    document.getElementById('bottom-nav').classList.remove('hidden');
                    switchTab('dashboard');
                } else {
                    document.getElementById('view-login').classList.remove('hidden');
                    document.getElementById('bottom-nav').classList.add('hidden');
                }
            } catch (err) {
                console.error('Status error:', err);
                document.getElementById('view-loading').classList.add('hidden');
                document.getElementById('view-login').classList.remove('hidden');
            }
        }

        function renderAccount(data) {
            document.getElementById('account-name').innerText = data.name;
            document.getElementById('account-email').innerText = data.email;

            const handle = user?.username ? `@${user.username}` : (user?.first_name || '');
            if (handle) {
                document.getElementById('account-tg-user').innerText = `Telegram: ${handle}`;
            }

            const role = data.role || 'STAFF';
            const badge = document.getElementById('account-role-badge');
            badge.innerText = role.replace('_', ' ');
            badge.className = `text-xs px-2.5 py-0.5 rounded-full font-bold ${ROLE_BADGES[role] || 'bg-slate-500/20 text-slate-300'}`;

            document.getElementById('account-role-desc').innerText = ROLE_DESCRIPTIONS[role] || 'Active KC Shop inventory notifications.';
        }

        // 2. Dashboard Loader
        async function loadDashboardData() {
            try {
                const res = await fetch('/api/v1/telegram/miniapp/dashboard', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ init_data: initData })
                });
                const json = await res.json();

                if (json.success) {
                    const d = json.data;
                    document.getElementById('dash-revenue').innerText = `$${Number(d.net_revenue).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                    document.getElementById('dash-orders-count').innerText = d.orders_count;
                    document.getElementById('dash-avg-basket').innerText = `$${Number(d.avg_basket).toFixed(2)}`;
                    document.getElementById('dash-low-stock-count').innerText = d.low_stock_count;

                    const roleBadge = document.getElementById('dash-role-badge');
                    roleBadge.innerText = (d.user_role || 'STAFF').replace('_', ' ');
                    roleBadge.className = `text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${ROLE_BADGES[d.user_role] || 'bg-slate-500/20 text-slate-300'}`;

                    if (d.is_seller) {
                        document.getElementById('dash-user-scope').innerText = `Personal Sales for ${d.user_name}`;
                    } else {
                        document.getElementById('dash-user-scope').innerText = `Store-wide Completed Sales`;
                    }

                    // Payment Bar
                    document.getElementById('dash-digital-pct').innerText = `${d.digital_pct}% Digital`;
                    document.getElementById('bar-digital').style.width = `${d.digital_pct}%`;
                    document.getElementById('bar-cash').style.width = `${100 - d.digital_pct}%`;
                    document.getElementById('dash-cash-count').innerText = d.cash_payments;
                    document.getElementById('dash-digital-count').innerText = d.digital_payments;

                    // Urgent Items
                    const urgentContainer = document.getElementById('urgent-items-list');
                    document.getElementById('urgent-badge-count').innerText = `${d.urgent_items.length} Items`;
                    if (d.urgent_items.length > 0) {
                        urgentContainer.innerHTML = d.urgent_items.map(item => `
                            <div onclick="quickScanSku('${item.sku}')" class="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between cursor-pointer active:scale-98 transition">
                                <div class="truncate mr-2">
                                    <p class="text-xs font-bold text-white truncate">${item.name}</p>
                                    <p class="text-[10px] text-slate-400 font-mono">${item.sku}</p>
                                </div>
                                <div class="text-right flex-shrink-0">
                                    <span class="text-xs font-black text-rose-400">${item.quantity_on_hand}</span>
                                    <span class="text-[10px] text-slate-400">/ ${item.reorder_level} min</span>
                                </div>
                            </div>
                        `).join('');
                    } else {
                        urgentContainer.innerHTML = `<p class="text-xs text-slate-500 text-center py-2">No critical low stock items right now.</p>`;
                    }

                    // Top Items
                    const topContainer = document.getElementById('top-items-list');
                    if (d.top_items.length > 0) {
                        topContainer.innerHTML = d.top_items.map((item, idx) => `
                            <div class="p-2 rounded-xl bg-slate-800/50 flex items-center justify-between text-xs">
                                <span class="truncate mr-2 text-slate-200"><strong>#${idx + 1}</strong> ${item.name}</span>
                                <span class="font-bold text-amber-400">${item.total_sold} sold</span>
                            </div>
                        `).join('');
                    } else {
                        topContainer.innerHTML = `<p class="text-xs text-slate-500 text-center py-2">No orders recorded yet today.</p>`;
                    }
                }
            } catch (err) {
                console.error('Dashboard error:', err);
            }
        }

        // 3. Barcode Scanner Functions
        function openTelegramScanner() {
            if (tg?.showScanQrPopup) {
                tg.showScanQrPopup({ text: "Scan Item Barcode or QR Code" }, (text) => {
                    tg.closeScanQrPopup();
                    if (text) {
                        lookupCode(text);
                    }
                    return true;
                });
            } else {
                // Fallback prompt for browser testing
                const manual = prompt("Camera scanner is native to Telegram mobile app. Enter barcode or SKU to test:");
                if (manual) {
                    lookupCode(manual);
                }
            }
        }

        function handleManualSearch(e) {
            e.preventDefault();
            const code = document.getElementById('scan-manual-input').value.trim();
            if (code) {
                lookupCode(code);
            }
        }

        function quickScanSku(sku) {
            switchTab('scanner');
            lookupCode(sku);
        }

        async function lookupCode(code) {
            const loading = document.getElementById('scan-loading');
            const errBox = document.getElementById('scan-error');
            const resCard = document.getElementById('scan-result-card');

            errBox.classList.add('hidden');
            resCard.classList.add('hidden');
            loading.classList.remove('hidden');

            try {
                const res = await fetch('/api/v1/telegram/miniapp/scan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ init_data: initData, code: code })
                });
                const json = await res.json();
                loading.classList.add('hidden');

                if (json.success && json.type === 'variant') {
                    if (tg?.HapticFeedback) {
                        tg.HapticFeedback.notificationOccurred('success');
                    }
                    renderScannedVariant(json.data);
                } else if (json.success && json.type === 'product') {
                    // Show first variant
                    if (json.data.variants && json.data.variants.length > 0) {
                        renderScannedVariant({ ...json.data.variants[0], name: json.data.name });
                    }
                } else {
                    if (tg?.HapticFeedback) {
                        tg.HapticFeedback.notificationOccurred('error');
                    }
                    document.getElementById('scan-error-text').innerText = json.message || 'Product not found.';
                    errBox.classList.remove('hidden');
                }
            } catch (err) {
                loading.classList.add('hidden');
                document.getElementById('scan-error-text').innerText = 'Lookup failed. Check connection.';
                errBox.classList.remove('hidden');
            }
        }

        function renderScannedVariant(v) {
            currentScannedVariant = v;
            document.getElementById('res-product-name').innerText = v.name;
            document.getElementById('res-sku').innerText = `SKU: ${v.sku}${v.barcode ? ' • ' + v.barcode : ''}`;
            document.getElementById('res-retail-price').innerText = `$${Number(v.retail_price).toFixed(2)}`;
            document.getElementById('res-stock-qty').innerText = v.quantity_on_hand;
            document.getElementById('res-reorder-level').innerText = `${v.reorder_level} units`;
            document.getElementById('adjust-new-qty').value = v.quantity_on_hand;

            // Status badge
            const badge = document.getElementById('res-badge-status');
            if (v.quantity_on_hand <= 0) {
                badge.innerText = 'Out of Stock';
                badge.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30';
            } else if (v.quantity_on_hand <= v.reorder_level) {
                badge.innerText = 'Low Stock';
                badge.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30';
            } else {
                badge.innerText = 'In Stock';
                badge.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
            }

            // Cost price display (if privileged)
            const costEl = document.getElementById('res-cost-price');
            if (v.cost_price !== null && v.cost_price !== undefined) {
                costEl.innerText = `Cost: $${Number(v.cost_price).toFixed(2)}`;
                costEl.classList.remove('hidden');
            } else {
                costEl.classList.add('hidden');
            }

            // Adjustment section permission
            const adjustSection = document.getElementById('res-adjust-section');
            if (v.can_adjust_stock) {
                adjustSection.classList.remove('hidden');
            } else {
                adjustSection.classList.add('hidden');
            }

            document.getElementById('scan-result-card').classList.remove('hidden');
        }

        // Stepper
        function stepAdjustment(delta) {
            const input = document.getElementById('adjust-new-qty');
            const current = parseInt(input.value) || 0;
            const next = Math.max(0, current + delta);
            input.value = next;
            if (tg?.HapticFeedback) {
                tg.HapticFeedback.selectionChanged();
            }
        }

        // Submit adjustment
        async function submitStockAdjustment() {
            if (!currentScannedVariant) return;

            const btn = document.getElementById('btn-save-adjust');
            const newQty = parseInt(document.getElementById('adjust-new-qty').value);
            const reason = document.getElementById('adjust-reason').value;

            if (isNaN(newQty) || newQty < 0) {
                alert('Please enter a valid stock quantity.');
                return;
            }

            btn.disabled = true;
            btn.innerHTML = `<span>Saving...</span>`;

            try {
                const res = await fetch('/api/v1/telegram/miniapp/adjust-stock', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        init_data: initData,
                        variant_id: currentScannedVariant.id,
                        new_quantity: newQty,
                        reason: reason
                    })
                });
                const json = await res.json();

                if (json.success) {
                    if (tg?.HapticFeedback) {
                        tg.HapticFeedback.notificationOccurred('success');
                    }
                    currentScannedVariant.quantity_on_hand = json.data.quantity_on_hand;
                    renderScannedVariant(currentScannedVariant);
                    alert(`✅ ${json.message}`);
                } else {
                    alert(`❌ ${json.message}`);
                }
            } catch (err) {
                alert('Failed to update stock. Check connection.');
            } finally {
                btn.disabled = false;
                btn.innerHTML = `<span>Save Stock Count</span>`;
            }
        }

        // 4. Authentication / Login
        async function handleLogin(e) {
            e.preventDefault();
            const btn = document.getElementById('btn-login-submit');
            const errBox = document.getElementById('login-error');
            const errText = document.getElementById('login-error-text');

            errBox.classList.add('hidden');
            btn.disabled = true;
            btn.innerText = 'Connecting...';

            const login = document.getElementById('login-input').value;
            const password = document.getElementById('password-input').value;

            try {
                const res = await fetch('/api/v1/telegram/miniapp/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        login: login,
                        password: password,
                        init_data: initData
                    })
                });
                const json = await res.json();

                if (json.success) {
                    if (tg?.HapticFeedback) {
                        tg.HapticFeedback.notificationOccurred('success');
                    }
                    checkStatus();
                } else {
                    if (tg?.HapticFeedback) {
                        tg.HapticFeedback.notificationOccurred('error');
                    }
                    errText.innerText = json.message || 'Login failed. Check your credentials.';
                    errBox.classList.remove('hidden');
                }
            } catch (err) {
                errText.innerText = 'Network error. Please try again.';
                errBox.classList.remove('hidden');
            } finally {
                btn.disabled = false;
                btn.innerText = 'Connect to KC Shop';
            }
        }

        // 5. Unlink
        async function unlinkAccount() {
            if (!confirm('Disconnect your Telegram from KC Shop?')) return;
            const btn = document.getElementById('btn-account-unlink');
            btn.innerText = 'Disconnecting...';
            btn.disabled = true;

            try {
                const res = await fetch('/api/v1/telegram/miniapp/unlink', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ init_data: initData })
                });
                const json = await res.json();
                if (json.success) {
                    if (tg?.HapticFeedback) {
                        tg.HapticFeedback.notificationOccurred('warning');
                    }
                    checkStatus();
                }
            } catch (err) {
                alert('Failed to disconnect. Please try again.');
            } finally {
                btn.innerText = 'Disconnect Telegram Account';
                btn.disabled = false;
            }
        }

        function closeApp() {
            if (tg) {
                tg.close();
            }
        }

        // Initialize on page load
        checkStatus();
    </script>
</body>
</html>
