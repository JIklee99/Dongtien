/*
====================================================
ĐẦU TƯ CỔ TỨC
APP.JS

PHẦN DỰ PHÓNG MỚI

MÔ HÌNH:

                CP NGUỒN
                   │
                   │
                   ▼
             Cổ tức nguồn
                   │
                   │
                   ▼
              TIỀN MẶT
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
 Tiền nạp thêm          Cổ tức tái đầu tư
        │                     │
        └──────────┬──────────┘
                   ▼
             MUA CP ĐÍCH
             theo lô 100
                   │
                   ▼
          Các lô CP riêng biệt
                   │
                   ▼
       Cổ tức của CP đích
                   │
                   ▼
             Tiếp tục mua
             CP đích

QUAN TRỌNG:

1. CP nguồn và CP đích tách riêng.

2. Cổ tức CP nguồn:
   CP nguồn × cổ tức nguồn.

3. Cổ tức CP đích:
   từng lô CP đích đã tồn tại
   từ năm trước × cổ tức đích.

4. CP đích vừa mua trong năm:
   KHÔNG nhận cổ tức của năm đó.

5. Mua CP đích theo lô 100.

6. Tiền chưa đủ mua lô 100:
   giữ lại tiền mặt.

7. Tiền mặt được tính lãi.

8. Giá ADP và giá SJD tách riêng.

9. Giá trị ADP và SJD tách riêng.

10. CP nguồn không bị cộng CP đích.
====================================================
*/


const STORAGE_KEY =
    "dautucotuc_v4";


const DEFAULT_DATA = {

    deposits: [],

    transactions: [],

    dividends: [],

    settings: {

        fee: 0.25,

        custody: 0.009,

        interest: 4,

        custodyEnabled: true

    }

};


let data = loadData();


/* ==================================================
   UTILITY
================================================== */

function clone(obj) {

    return JSON.parse(
        JSON.stringify(obj)
    );

}


function uid(prefix) {

    return (
        prefix +
        "_" +
        Date.now() +
        "_" +
        Math.random()
            .toString(36)
            .slice(2, 8)
    );

}


function today() {

    return new Date()
        .toISOString()
        .slice(0, 10);

}


function money(value) {

    return new Intl.NumberFormat(
        "vi-VN",
        {
            maximumFractionDigits: 2
        }
    ).format(
        Number(value) || 0
    ) + " đ";

}


function number(value, digits = 0) {

    return new Intl.NumberFormat(
        "vi-VN",
        {
            maximumFractionDigits: digits
        }
    ).format(
        Number(value) || 0
    );

}


function projectionMoney(value) {

    return new Intl.NumberFormat(
        "vi-VN",
        {
            maximumFractionDigits: 0
        }
    ).format(
        Math.round(
            Number(value) || 0
        )
    ) + " đ";

}


function projectionNumber(value) {

    return new Intl.NumberFormat(
        "vi-VN",
        {
            maximumFractionDigits: 0
        }
    ).format(
        Math.round(
            Number(value) || 0
        )
    );

}


function escapeHTML(value) {

    return String(value ?? "")
        .replace(
            /[&<>"']/g,
            char => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[char])
        );

}


function daysBetween(start, end) {

    if (!start || !end)
        return 0;

    const a =
        new Date(
            start + "T00:00:00"
        );

    const b =
        new Date(
            end + "T00:00:00"
        );

    return Math.max(
        0,
        Math.floor(
            (b - a) / 86400000
        )
    );

}


function mergeData(base, source) {

    for (const key in source) {

        if (
            source[key] &&
            typeof source[key] === "object" &&
            !Array.isArray(source[key])
        ) {

            base[key] =
                mergeData(
                    base[key] || {},
                    source[key]
                );

        } else {

            base[key] =
                source[key];

        }

    }

    return base;

}


/* ==================================================
   STORAGE
================================================== */

function loadData() {

    try {

        const saved =
            localStorage.getItem(
                STORAGE_KEY
            );

        if (!saved) {

            return clone(
                DEFAULT_DATA
            );

        }

        return mergeData(
            clone(DEFAULT_DATA),
            JSON.parse(saved)
        );

    } catch (error) {

        console.error(error);

        return clone(
            DEFAULT_DATA
        );

    }

}


function saveData() {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
    );

    renderAll();

}


/* ==================================================
   TOAST
================================================== */

function toast(message) {

    const el =
        document.getElementById(
            "toast"
        );

    if (!el)
        return;

    el.textContent =
        message;

    el.classList.add("show");

    clearTimeout(
        window.__toastTimer
    );

    window.__toastTimer =
        setTimeout(
            () => {

                el.classList.remove(
                    "show"
                );

            },
            2500
        );

}


/* ==================================================
   FEE
================================================== */

function calculateTradingFee(amount) {

    return (
        Number(amount) || 0
    ) *
    (
        Number(
            data.settings.fee
        ) || 0
    ) /
    100;

}


/* ==================================================
   DEPOSIT
================================================== */

function addDeposit(form) {

    const amount =
        Number(
            form.amount.value
        );

    if (amount <= 0) {

        throw new Error(
            "Số tiền nạp phải lớn hơn 0."
        );

    }

    data.deposits.push({

        id:
            uid("deposit"),

        date:
            form.date.value || today(),

        amount,

        note:
            form.note.value.trim()

    });

    saveData();

    form.reset();

    form.date.value =
        today();

    toast(
        "Đã nạp tiền."
    );

}


/* ==================================================
   SYMBOL
================================================== */

function getSymbols() {

    const symbols =
        new Set();

    data.transactions.forEach(
        t => {

            if (t.symbol)
                symbols.add(
                    t.symbol
                );

        }
    );

    data.dividends.forEach(
        d => {

            if (d.symbol)
                symbols.add(
                    d.symbol
                );

        }
    );

    return Array.from(
        symbols
    ).sort();

}


/* ==================================================
   FIFO
================================================== */

function replaySymbol(symbol) {

    const events = [];


    data.transactions
        .filter(
            t =>
                t.symbol === symbol
        )
        .forEach(
            t => {

                events.push({

                    ...t,

                    eventType:
                        t.type

                });

            }
        );


    data.dividends
        .filter(
            d =>
                d.symbol === symbol &&
                d.type !== "cash" &&
                Number(
                    d.receivedQty
                ) > 0
        )
        .forEach(
            d => {

                events.push({

                    id:
                        d.id,

                    date:
                        d.payDate,

                    symbol,

                    eventType:
                        "stockDividend",

                    qty:
                        Number(
                            d.receivedQty
                        ) || 0,

                    price: 0

                });

            }
        );


    events.sort(
        (a, b) => {

            const result =
                String(a.date)
                    .localeCompare(
                        String(b.date)
                    );

            if (result !== 0)
                return result;

            const priority = {

                stockDividend: 0,

                buy: 1,

                sell: 2

            };

            return (
                (priority[a.eventType] ?? 1) -
                (priority[b.eventType] ?? 1)
            );

        }
    );


    const lots = [];


    for (
        const event of events
    ) {

        if (
            event.eventType === "buy"
        ) {

            lots.push({

                id:
                    event.id,

                date:
                    event.date,

                qty:
                    Number(
                        event.qty
                    ) || 0,

                price:
                    Number(
                        event.price
                    ) || 0

            });

        }

        else if (
            event.eventType ===
            "stockDividend"
        ) {

            lots.push({

                id:
                    uid("divlot"),

                date:
                    event.date,

                qty:
                    Number(
                        event.qty
                    ) || 0,

                price: 0

            });

        }

        else if (
            event.eventType === "sell"
        ) {

            let remaining =
                Number(
                    event.qty
                ) || 0;


            for (
                const lot of lots
            ) {

                if (
                    remaining <= 0
                )
                    break;


                const take =
                    Math.min(
                        lot.qty,
                        remaining
                    );


                lot.qty -=
                    take;

                remaining -=
                    take;

            }


            if (
                remaining >
                0.000001
            ) {

                throw new Error(
                    `Không đủ ${symbol} để bán.`
                );

            }

        }

    }


    return lots.filter(
        lot =>
            lot.qty >
            0.000001
    );

}


function getHoldingLots(symbol) {

    return replaySymbol(
        symbol
    );

}


function getHoldingQuantity(symbol) {

    return getHoldingLots(
        symbol
    ).reduce(
        (sum, lot) =>
            sum + lot.qty,
        0
    );

}


/* ==================================================
   HOLDING AT RECORD DATE
================================================== */

function getHoldingAtDate(
    symbol,
    date
) {

    const events = [];


    data.transactions
        .filter(
            t =>
                t.symbol === symbol &&
                t.date <= date
        )
        .forEach(
            t => {

                events.push({

                    date:
                        t.date,

                    type:
                        t.type,

                    qty:
                        Number(
                            t.qty
                        ) || 0

                });

            }
        );


    data.dividends
        .filter(
            d =>
                d.symbol === symbol &&
                d.type !== "cash" &&
                d.payDate <= date
        )
        .forEach(
            d => {

                events.push({

                    date:
                        d.payDate,

                    type:
                        "stockDividend",

                    qty:
                        Number(
                            d.receivedQty
                        ) || 0

                });

            }
        );


    events.sort(
        (a, b) =>
            String(a.date)
                .localeCompare(
                    String(b.date)
                )
    );


    const lots = [];


    for (
        const event of events
    ) {

        if (
            event.type === "buy" ||
            event.type === "stockDividend"
        ) {

            lots.push({

                qty:
                    event.qty

            });

        }

        else if (
            event.type === "sell"
        ) {

            let remaining =
                event.qty;


            for (
                const lot of lots
            ) {

                if (
                    remaining <= 0
                )
                    break;


                const take =
                    Math.min(
                        lot.qty,
                        remaining
                    );


                lot.qty -=
                    take;

                remaining -=
                    take;

            }

        }

    }


    return lots.reduce(
        (sum, lot) =>
            sum + lot.qty,
        0
    );

}


/* ==================================================
   CASH
================================================== */

function calculateCash() {

    let cash = 0;


    data.deposits.forEach(
        d => {

            cash +=
                Number(
                    d.amount
                ) || 0;

        }
    );


    data.transactions.forEach(
        t => {

            if (
                t.type === "buy" &&
                t.source === "cash"
            ) {

                cash -=
                    Number(
                        t.total
                    ) || 0;

            }


            if (
                t.type === "sell"
            ) {

                cash +=
                    Number(
                        t.net
                    ) || 0;

            }

        }
    );


    return cash;

}


/* ==================================================
   DIVIDEND WALLET
================================================== */

function calculateDividendWallet() {

    let wallet = 0;


    data.dividends
        .filter(
            d =>
                d.type === "cash"
        )
        .forEach(
            d => {

                wallet +=
                    Number(
                        d.cashTotal
                    ) || 0;

            }
        );


    data.transactions
        .filter(
            t =>
                t.type === "buy" &&
                t.source === "dividend"
        )
        .forEach(
            t => {

                wallet -=
                    Number(
                        t.total
                    ) || 0;

            }

        );


    return Math.max(
        0,
        wallet
    );

}


/* ==================================================
   CASH INTEREST
================================================== */

function calculateCashInterest() {

    const events = [];


    data.deposits.forEach(
        d => {

            events.push({

                date:
                    d.date,

                delta:
                    Number(
                        d.amount
                    ) || 0

            });

        }
    );


    data.transactions.forEach(
        t => {

            if (
                t.type === "buy" &&
                t.source === "cash"
            ) {

                events.push({

                    date:
                        t.date,

                    delta:
                        -Number(
                            t.total
                        )

                });

            }


            if (
                t.type === "sell"
            ) {

                events.push({

                    date:
                        t.date,

                    delta:
                        Number(
                            t.net
                        )

                });

            }

        }
    );


    if (
        events.length === 0
    )
        return 0;


    events.sort(
        (a, b) =>
            String(a.date)
                .localeCompare(
                    String(b.date)
                )
    );


    let balance = 0;

    let interest = 0;

    let previous =
        events[0].date;


    for (
        const event of events
    ) {

        const days =
            daysBetween(
                previous,
                event.date
            );


        if (days > 0) {

            interest +=
                Math.max(
                    0,
                    balance
                ) *
                (
                    Number(
                        data.settings.interest
                    ) || 0
                ) /
                100 *
                days /
                365;

        }


        balance +=
            event.delta;

        previous =
            event.date;

    }


    const finalDays =
        daysBetween(
            previous,
            today()
        );


    interest +=
        Math.max(
            0,
            balance
        ) *
        (
            Number(
                data.settings.interest
            ) || 0
        ) /
        100 *
        finalDays /
        365;


    return Math.max(
        0,
        interest
    );

}


/* ==================================================
   CUSTODY
================================================== */

function calculateCustodyFee() {

    if (
        !data.settings.custodyEnabled
    )
        return 0;


    let total = 0;


    for (
        const symbol of getSymbols()
    ) {

        const lots =
            getHoldingLots(
                symbol
            );


        lots.forEach(
            lot => {

                total +=
                    lot.qty *
                    Number(
                        data.settings.custody
                    ) *
                    daysBetween(
                        lot.date,
                        today()
                    );

            }
        );

    }


    return total;

}


/* ==================================================
   PORTFOLIO
================================================== */

function getPortfolio() {

    const result = [];


    getSymbols().forEach(
        symbol => {

            const lots =
                getHoldingLots(
                    symbol
                );


            const quantity =
                lots.reduce(
                    (s, l) =>
                        s + l.qty,
                    0
                );


            const cost =
                lots.reduce(
                    (s, l) =>
                        s +
                        l.qty *
                        l.price,
                    0
                );


            const averageCost =
                quantity
                    ? cost / quantity
                    : 0;


            const cashDividend =
                data.dividends
                    .filter(
                        d =>
                            d.symbol === symbol &&
                            d.type === "cash"
                    )
                    .reduce(
                        (s, d) =>
                            s +
                            Number(
                                d.cashTotal
                            ),
                        0
                    );


            const stockDividend =
                data.dividends
                    .filter(
                        d =>
                            d.symbol === symbol &&
                            d.type !== "cash"
                    )
                    .reduce(
                        (s, d) =>
                            s +
                            Number(
                                d.receivedQty
                            ),
                        0
                    );


            result.push({

                symbol,

                lots,

                quantity,

                cost,

                averageCost,

                cashDividend,

                stockDividend

            });

        }
    );


    return result.filter(
        x =>
            x.quantity > 0 ||
            x.cashDividend > 0 ||
            x.stockDividend > 0
    );

}


/* ==================================================
   ADD TRADE
================================================== */

function addTrade(form) {

    const type =
        form.type.value;

    const date =
        form.date.value;

    const symbol =
        form.symbol.value
            .trim()
            .toUpperCase();

    const qty =
        Number(
            form.qty.value
        );

    const price =
        Number(
            form.price.value
        );

    let source =
        form.source.value;


    if (
        !date ||
        !symbol ||
        qty <= 0 ||
        price < 0
    ) {

        throw new Error(
            "Kiểm tra thông tin giao dịch."
        );

    }


    if (
        type === "sell"
    ) {

        source =
            "cash";

    }


    const value =
        qty *
        price;


    const fee =
        calculateTradingFee(
            value
        );


    const total =
        value +
        fee;


    if (
        type === "buy"
    ) {

        if (
            source === "cash" &&
            calculateCash() < total
        ) {

            throw new Error(
                "Không đủ tiền mặt."
            );

        }


        if (
            source === "dividend" &&
            calculateDividendWallet() < total
        ) {

            throw new Error(
                "Không đủ ví cổ tức."
            );

        }


        data.transactions.push({

            id:
                uid("tx"),

            type:
                "buy",

            date,

            symbol,

            qty,

            price,

            fee,

            total,

            source,

            note:
                form.note.value.trim()

        });

    }

    else {

        const holding =
            getHoldingQuantity(
                symbol
            );


        if (
            holding < qty
        ) {

            throw new Error(
                `Không đủ ${symbol} để bán.`
            );

        }


        const net =
            value -
            fee;


        data.transactions.push({

            id:
                uid("tx"),

            type:
                "sell",

            date,

            symbol,

            qty,

            price,

            fee,

            total:
                value,

            net,

            source:
                "cash",

            note:
                form.note.value.trim()

        });

    }


    try {

        getSymbols()
            .forEach(
                s =>
                    getHoldingLots(s)
            );

    } catch (error) {

        data.transactions.pop();

        throw error;

    }


    saveData();

    resetTradeForm();

    toast(
        type === "buy"
            ? "Đã mua cổ phiếu."
            : "Đã bán cổ phiếu."
    );

}


/* ==================================================
   DIVIDEND
================================================== */

function addDividend(form) {

    const symbol =
        form.symbol.value
            .trim()
            .toUpperCase();

    const type =
        form.type.value;

    const recordDate =
        form.recordDate.value;

    const payDate =
        form.payDate.value;


    if (
        !symbol ||
        !recordDate ||
        !payDate
    ) {

        throw new Error(
            "Thiếu thông tin cổ tức."
        );

    }


    const eligible =
        Math.floor(
            getHoldingAtDate(
                symbol,
                recordDate
            )
        );


    if (
        eligible <= 0
    ) {

        throw new Error(
            `Không có ${symbol} đủ điều kiện nhận cổ tức.`
        );

    }


    const dividend = {

        id:
            uid("dividend"),

        symbol,

        type,

        recordDate,

        payDate,

        eligible,

        note:
            form.note.value.trim()

    };


    if (
        type === "cash"
    ) {

        const perShare =
            Number(
                form.cashPerShare.value
            );


        if (
            perShare <= 0
        ) {

            throw new Error(
                "Cổ tức / CP phải lớn hơn 0."
            );

        }


        dividend.cashPerShare =
            perShare;

        dividend.cashTotal =
            eligible *
            perShare;

    }

    else {

        const base =
            Number(
                form.ratioBase.value
            );

        const newShares =
            Number(
                form.ratioNew.value
            );


        if (
            base <= 0 ||
            newShares < 0
        ) {

            throw new Error(
                "Tỷ lệ cổ phiếu không hợp lệ."
            );

        }


        dividend.ratioBase =
            base;

        dividend.ratioNew =
            newShares;

        dividend.receivedQty =
            Math.floor(
                eligible *
                newShares /
                base
            );

    }


    data.dividends.push(
        dividend
    );

    saveData();

    form.reset();

    form.recordDate.value =
        today();

    form.payDate.value =
        today();

    form.ratioBase.value =
        10;

    form.ratioNew.value =
        1;

    toggleDividendFields();

    toast(
        "Đã lưu cổ tức."
    );

}


/* ==================================================
   DELETE
================================================== */

function deleteTransaction(id) {

    if (
        !confirm(
            "Xóa giao dịch này?"
        )
    )
        return;


    const backup =
        clone(data);


    data.transactions =
        data.transactions.filter(
            t =>
                t.id !== id
        );


    try {

        getSymbols()
            .forEach(
                s =>
                    getHoldingLots(s)
            );

        saveData();

        toast(
            "Đã xóa giao dịch."
        );

    } catch (error) {

        data =
            backup;

        saveData();

        alert(
            error.message
        );

    }

}


function deleteDividend(id) {

    if (
        !confirm(
            "Xóa quyền cổ tức này?"
        )
    )
        return;


    data.dividends =
        data.dividends.filter(
            d =>
                d.id !== id
        );


    saveData();

    toast(
        "Đã xóa cổ tức."
    );

}


/* ==================================================
   DASHBOARD
================================================== */

function renderDashboard() {

    const portfolio =
        getPortfolio();


    const deposits =
        data.deposits.reduce(
            (s, d) =>
                s +
                Number(
                    d.amount
                ),
            0
        );


    const cash =
        calculateCash();


    const wallet =
        calculateDividendWallet();


    const invested =
        portfolio.reduce(
            (s, p) =>
                s + p.cost,
            0
        );


    const dividend =
        data.dividends
            .filter(
                d =>
                    d.type === "cash"
            )
            .reduce(
                (s, d) =>
                    s +
                    Number(
                        d.cashTotal
                    ),
                0
            );


    const cards = [

        [
            "Tổng tiền nạp",
            money(deposits)
        ],

        [
            "Tiền mặt",
            money(cash)
        ],

        [
            "Ví cổ tức",
            money(wallet)
        ],

        [
            "Tiền khả dụng",
            money(cash + wallet)
        ],

        [
            "Vốn cổ phiếu",
            money(invested)
        ],

        [
            "Cổ tức tiền mặt",
            money(dividend)
        ],

        [
            "Lãi tiền mặt",
            money(
                calculateCashInterest()
            )
        ],

        [
            "Phí lưu ký",
            money(
                calculateCustodyFee()
            )
        ]

    ];


    const element =
        document.getElementById(
            "dashboardCards"
        );


    if (!element)
        return;


    element.innerHTML =
        cards.map(
            card => `

                <div class="stat">

                    <div class="label">
                        ${card[0]}
                    </div>

                    <div class="value">
                        ${card[1]}
                    </div>

                </div>

            `
        ).join("");

}


/* ==================================================
   PORTFOLIO
================================================== */

function renderPortfolio() {

    const element =
        document.getElementById(
            "portfolio"
        );


    if (!element)
        return;


    const portfolio =
        getPortfolio();


    if (!portfolio.length) {

        element.innerHTML = `

            <div class="card">

                <div class="hint">
                    Chưa có cổ phiếu.
                </div>

            </div>

        `;

        return;

    }


    element.innerHTML =
        portfolio.map(
            p => `

                <div class="card stock-card">

                    <h3>
                        ${escapeHTML(
                            p.symbol
                        )}
                    </h3>

                    <div class="stock-meta">

                        <div class="kv">

                            <span>Số CP</span>

                            <b>
                                ${number(
                                    p.quantity
                                )}
                            </b>

                        </div>


                        <div class="kv">

                            <span>
                                Giá vốn BQ
                            </span>

                            <b>
                                ${money(
                                    p.averageCost
                                )}
                            </b>

                        </div>


                        <div class="kv">

                            <span>
                                Giá vốn còn lại
                            </span>

                            <b>
                                ${money(
                                    p.cost
                                )}
                            </b>

                        </div>


                        <div class="kv">

                            <span>Số lô</span>

                            <b>
                                ${p.lots.length}
                            </b>

                        </div>


                        <div class="kv">

                            <span>
                                Cổ tức tiền
                            </span>

                            <b>
                                ${money(
                                    p.cashDividend
                                )}
                            </b>

                        </div>


                        <div class="kv">

                            <span>
                                CP từ quyền
                            </span>

                            <b>
                                ${number(
                                    p.stockDividend
                                )}
                            </b>

                        </div>

                    </div>

                </div>

            `
        ).join("");

}


/* ==================================================
   TABLE
================================================== */

function transactionTable(
    transactions
) {

    if (!transactions.length) {

        return `

            <div class="hint">
                Chưa có dữ liệu.
            </div>

        `;

    }


    const sorted =
        transactions
            .slice()
            .sort(
                (a, b) =>
                    String(b.date)
                        .localeCompare(
                            String(a.date)
                        )
            );


    return `

        <div class="table-scroll">

            <table>

                <thead>

                    <tr>

                        <th>Ngày</th>
                        <th>Loại</th>
                        <th>Mã</th>
                        <th>SL</th>
                        <th>Giá</th>
                        <th>Phí</th>
                        <th>Tổng</th>
                        <th>Nguồn</th>
                        <th></th>

                    </tr>

                </thead>


                <tbody>

                    ${sorted.map(
                        t => `

                            <tr>

                                <td>
                                    ${escapeHTML(
                                        t.date
                                    )}
                                </td>

                                <td class="${
                                    t.type === "sell"
                                        ? "red"
                                        : "green"
                                }">

                                    ${
                                        t.type === "buy"
                                            ? "MUA"
                                            : "BÁN"
                                    }

                                </td>

                                <td>
                                    ${escapeHTML(
                                        t.symbol
                                    )}
                                </td>

                                <td>
                                    ${number(
                                        t.qty
                                    )}
                                </td>

                                <td>
                                    ${money(
                                        t.price
                                    )}
                                </td>

                                <td>
                                    ${money(
                                        t.fee
                                    )}
                                </td>

                                <td>
                                    ${money(
                                        t.total
                                    )}
                                </td>

                                <td>

                                    ${
                                        t.type === "buy"
                                            ? (
                                                t.source === "dividend"
                                                    ? "Ví cổ tức"
                                                    : "Tiền mặt"
                                            )
                                            : "Tiền mặt"
                                    }

                                </td>

                                <td>

                                    <button
                                        class="action"
                                        onclick="deleteTransaction('${t.id}')"
                                    >
                                        Xóa
                                    </button>

                                </td>

                            </tr>

                        `
                    ).join("")}

                </tbody>

            </table>

        </div>

    `;

}


/* ==================================================
   TRANSACTIONS
================================================== */

function renderTransactions() {

    const all =
        document.getElementById(
            "transactions"
        );


    const recent =
        document.getElementById(
            "recent"
        );


    if (all) {

        all.innerHTML =
            transactionTable(
                data.transactions
            );

    }


    if (recent) {

        recent.innerHTML =
            transactionTable(
                data.transactions
                    .slice()
                    .sort(
                        (a, b) =>
                            String(b.date)
                                .localeCompare(
                                    String(a.date)
                                )
                    )
                    .slice(0, 8)
            );

    }

}


/* ==================================================
   DIVIDENDS
================================================== */

function renderDividends() {

    const element =
        document.getElementById(
            "dividends"
        );


    if (!element)
        return;


    const dividends =
        data.dividends
            .slice()
            .sort(
                (a, b) =>
                    String(b.payDate)
                        .localeCompare(
                            String(a.payDate)
                        )
            );


    if (!dividends.length) {

        element.innerHTML = `

            <div class="hint">
                Chưa có lịch sử cổ tức.
            </div>

        `;

        return;

    }


    element.innerHTML = `

        <div class="table-scroll">

            <table>

                <thead>

                    <tr>

                        <th>Ngày chốt</th>
                        <th>Ngày nhận</th>
                        <th>Mã</th>
                        <th>Loại</th>
                        <th>CP đủ ĐK</th>
                        <th>Kết quả</th>
                        <th></th>

                    </tr>

                </thead>


                <tbody>

                    ${dividends.map(
                        d => {

                            const result =
                                d.type === "cash"
                                    ? money(
                                        d.cashTotal
                                    )
                                    :
                                    `${number(
                                        d.receivedQty
                                    )} CP (${d.ratioBase}:${d.ratioNew})`;


                            return `

                                <tr>

                                    <td>
                                        ${escapeHTML(
                                            d.recordDate
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            d.payDate
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            d.symbol
                                        )}
                                    </td>

                                    <td>

                                        ${
                                            d.type === "cash"
                                                ? "Tiền mặt"
                                                : d.type === "stock"
                                                    ? "Cổ tức CP"
                                                    : "CP thưởng"
                                        }

                                    </td>

                                    <td>
                                        ${number(
                                            d.eligible
                                        )}
                                    </td>

                                    <td>
                                        ${result}
                                    </td>

                                    <td>

                                        <button
                                            class="action"
                                            onclick="deleteDividend('${d.id}')"
                                        >
                                            Xóa
                                        </button>

                                    </td>

                                </tr>

                            `;

                        }
                    ).join("")}

                </tbody>

            </table>

        </div>

    `;

}


/* ==================================================
   SETTINGS
================================================== */

function renderSettings() {

    const form =
        document.getElementById(
            "settingsForm"
        );


    if (!form)
        return;


    form.fee.value =
        data.settings.fee;

    form.custody.value =
        data.settings.custody;

    form.interest.value =
        data.settings.interest;

    form.custodyEnabled.checked =
        !!data.settings.custodyEnabled;

}


/* ==================================================
   DIVIDEND FIELDS
================================================== */

function toggleDividendFields() {

    const type =
        document.querySelector(
            '#dividendForm [name="type"]'
        )?.value;


    const cash =
        document.getElementById(
            "cashDividendFields"
        );


    const stock =
        document.getElementById(
            "stockDividendFields"
        );


    if (!cash || !stock)
        return;


    cash.style.display =
        type === "cash"
            ? "block"
            : "none";


    stock.style.display =
        type === "cash"
            ? "none"
            : "block";

}


/* ==================================================
   RESET TRADE
================================================== */

function resetTradeForm() {

    const form =
        document.getElementById(
            "tradeForm"
        );


    if (!form)
        return;


    form.reset();

    form.date.value =
        today();

    form.type.value =
        "buy";

    form.source.value =
        "cash";

    form.source.disabled =
        false;

}


/* ==================================================
   BACKUP
================================================== */

function backupJSON() {

    const backup = {

        version: 4,

        exportedAt:
            new Date()
                .toISOString(),

        data

    };


    const blob =
        new Blob(
            [
                JSON.stringify(
                    backup,
                    null,
                    2
                )
            ],
            {
                type:
                    "application/json"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        url;

    link.download =
        `dautucotuc_backup_${today()}.json`;


    document.body.appendChild(
        link
    );

    link.click();

    link.remove();


    URL.revokeObjectURL(
        url
    );


    toast(
        "Đã xuất backup."
    );

}


/* ==================================================
   RESTORE
================================================== */

async function restoreJSON(file) {

    try {

        const text =
            await file.text();

        const backup =
            JSON.parse(text);

        const restored =
            backup.data ||
            backup;


        if (
            !Array.isArray(
                restored.deposits
            ) ||
            !Array.isArray(
                restored.transactions
            ) ||
            !Array.isArray(
                restored.dividends
            )
        ) {

            throw new Error(
                "File backup không hợp lệ."
            );

        }


        data =
            mergeData(
                clone(DEFAULT_DATA),
                restored
            );


        getSymbols()
            .forEach(
                s =>
                    getHoldingLots(s)
            );


        saveData();

        toast(
            "Đã khôi phục backup."
        );

    } catch (error) {

        alert(
            "Không thể khôi phục: " +
            error.message
        );

    }

}


/* ==================================================
   RESET
================================================== */

function resetAll() {

    if (
        !confirm(
            "Xóa TOÀN BỘ dữ liệu?"
        )
    )
        return;


    data =
        clone(
            DEFAULT_DATA
        );


    saveData();

    toast(
        "Đã xóa dữ liệu."
    );

}


/* ==================================================
   PROJECTION HELPERS
================================================== */


/*
   Tính lãi tiền mặt theo năm.

   Tiền có từ đầu năm:
   12 tháng.

   Tiền nạp mỗi tháng:
   tính theo số tháng còn lại.
*/

function calculateYearInterest(
    openingCash,
    monthlyContribution,
    annualRate
) {

    const rate =
        Math.max(
            0,
            Number(annualRate) || 0
        ) / 100;


    let interest =
        Math.max(
            0,
            openingCash
        ) * rate;


    const monthly =
        Math.max(
            0,
            Number(
                monthlyContribution
            ) || 0
        );


    for (
        let month = 1;
        month <= 12;
        month++
    ) {

        const monthsRemaining =
            12 - month;


        interest +=
            monthly *
            rate *
            monthsRemaining /
            12;

    }


    return interest;

}


/*
====================================================
ENGINE

CP nguồn:

sourceShares

CP đích:

reinvestLots

Mỗi lot:

{
    yearBought,
    shares,
    price
}

Cổ tức CP đích chỉ tính:

lot.yearBought < year

KHÔNG:

totalShares × targetDividend

====================================================
*/

function calculateProjectionScenario(
    options
) {

    const totalYears =
        Math.max(
            1,
            Math.floor(
                Number(
                    options.years
                ) || 1
            )
        );


    const contributionYears =
        Math.max(
            0,
            Math.min(
                totalYears,
                Math.floor(
                    Number(
                        options.contributionYears
                    ) || 0
                )
            )
        );


    const reinvestYears =
        Math.max(
            0,
            Math.min(
                totalYears,
                Math.floor(
                    Number(
                        options.reinvestYears
                    ) || 0
                )
            )
        );


    const holdingYears =
        Math.max(
            1,
            Math.min(
                totalYears,
                Math.floor(
                    Number(
                        options.holdingYears
                    ) || totalYears
                )
            )
        );


    const sourceShares =
        Math.max(
            0,
            Number(
                options.sourceShares
            ) || 0
        );


    const sourcePrice =
        Math.max(
            0,
            Number(
                options.sourcePrice
            ) || 0
        );


    const targetPrice =
        Math.max(
            0,
            Number(
                options.targetPrice
            ) || 0
        );


    const sourceDividend =
        Math.max(
            0,
            Number(
                options.sourceDividend
            ) || 0
        );


    const targetDividend =
        Math.max(
            0,
            Number(
                options.targetDividend
            ) || 0
        );


    const sourcePriceGrowth =
        Number(
            options.sourcePriceGrowth
        ) || 0;


    const targetPriceGrowth =
        Number(
            options.targetPriceGrowth
        ) || 0;


    const dividendGrowth =
        Number(
            options.dividendGrowth
        ) || 0;


    const targetDividendGrowth =
        Number(
            options.targetDividendGrowth
        ) || 0;


    const monthlyMoney =
        Math.max(
            0,
            Number(
                options.monthlyMoney
            ) || 0
        );


    const reinvestPercent =
        Math.max(
            0,
            Math.min(
                100,
                Number(
                    options.reinvestPercent
                ) || 0
            )
        );


    const cashInterest =
        Math.max(
            0,
            Number(
                options.cashInterest
            ) || 0
        );


    /*
       Tiền mặt ban đầu.

       Đây là tiền còn lại sau khi
       mua CP nguồn ban đầu nếu
       người dùng muốn mô phỏng.

       Mặc định = 0.
    */

    let cash =
        Math.max(
            0,
            Number(
                options.initialCash
            ) || 0
        );


    /*
       CP nguồn KHÔNG bao giờ
       cộng CP đích.
    */

    const fixedSourceShares =
        sourceShares;


    /*
       Các lô CP đích.

       Mỗi lô có thời gian riêng.
    */

    const reinvestLots = [];


    let totalSourceDividend =
        0;


    let totalTargetDividend =
        0;


    let totalDividend =
        0;


    let totalContribution =
        0;


    let totalReinvestMoney =
        0;


    let totalNewShares =
        0;


    let totalInterest =
        0;


    let totalTargetDividendUsed =
        0;


    const rows = [];


    for (
        let year = 1;
        year <= totalYears;
        year++
    ) {


        /* ==========================================
           GIÁ CP NGUỒN
        ========================================== */

        const currentSourcePrice =
            sourcePrice *
            Math.pow(
                1 +
                sourcePriceGrowth / 100,
                year - 1
            );


        /* ==========================================
           GIÁ CP ĐÍCH
        ========================================== */

        const currentTargetPrice =
            targetPrice *
            Math.pow(
                1 +
                targetPriceGrowth / 100,
                year - 1
            );


        /* ==========================================
           CỔ TỨC CP NGUỒN
        ========================================== */

        const currentSourceDividend =
            sourceDividend *
            Math.pow(
                1 +
                dividendGrowth / 100,
                year - 1
            );


        /* ==========================================
           CỔ TỨC CP ĐÍCH
        ========================================== */

        const currentTargetDividend =
            targetDividend *
            Math.pow(
                1 +
                targetDividendGrowth / 100,
                year - 1
            );


        /* ==========================================
           CỔ TỨC NGUỒN

           CHỈ CP NGUỒN.
        ========================================== */

        const yearlySourceDividend =
            fixedSourceShares *
            currentSourceDividend;


        /* ==========================================
           CỔ TỨC CP ĐÍCH

           Chỉ các lot từ năm trước.
        ========================================== */

        let reinvestSharesStart =
            0;


        let yearlyTargetDividend =
            0;


        reinvestLots.forEach(
            lot => {

                if (
                    lot.yearBought <
                    year
                ) {

                    reinvestSharesStart +=
                        lot.shares;


                    yearlyTargetDividend +=
                        lot.shares *
                        currentTargetDividend;

                }

            }
        );


        /* ==========================================
           TỔNG CỔ TỨC
        ========================================== */

        const yearlyDividend =
            yearlySourceDividend +
            yearlyTargetDividend;


        /* ==========================================
           TIỀN NẠP THÊM
        ========================================== */

        let contribution = 0;


        if (
            year <= contributionYears
        ) {

            contribution =
                monthlyMoney *
                12;

        }


        /* ==========================================
           LÃI TIỀN MẶT
        ========================================== */

        const yearlyInterest =
            calculateYearInterest(
                cash,
                year <= contributionYears
                    ? monthlyMoney
                    : 0,
                cashInterest
            );


        cash +=
            yearlyInterest;


        totalInterest +=
            yearlyInterest;


        /* ==========================================
           CỘNG TIỀN NẠP
        ========================================== */

        cash +=
            contribution;


        totalContribution +=
            contribution;


        /* ==========================================
           CỘNG CỔ TỨC

           Cả cổ tức nguồn và
           cổ tức CP đích đều về
           tiền mặt trước khi mua.
        ========================================== */

        cash +=
            yearlyDividend;


        totalDividend +=
            yearlyDividend;


        totalSourceDividend +=
            yearlySourceDividend;


        totalTargetDividend +=
            yearlyTargetDividend;


        /* ==========================================
           TIỀN ĐƯỢC PHÉP TÁI ĐẦU TƯ
        ========================================== */

        let purchaseMoney =
            0;


        let buyShares =
            0;


        const canReinvest =
            year <= reinvestYears;


        if (
            canReinvest &&
            currentTargetPrice > 0
        ) {

            /*
               Chỉ phần tiền được phép
               tái đầu tư mới được dùng.

               Phần còn lại vẫn giữ tiền mặt.
            */

            const availableMoney =
                Math.max(
                    0,
                    cash *
                    reinvestPercent /
                    100
                );


            /*
               Tính số CP có thể mua.
            */

            const possibleShares =
                Math.floor(
                    availableMoney /
                    currentTargetPrice
                );


            /*
               Chỉ mua lô 100.
            */

            buyShares =
                Math.floor(
                    possibleShares /
                    100
                ) *
                100;


            purchaseMoney =
                buyShares *
                currentTargetPrice;


            /*
               Trừ tiền mua.

               Tiền thừa giữ lại.
            */

            cash -=
                purchaseMoney;


            /*
               Lưu lot CP đích.

               CP này chỉ nhận cổ tức
               từ năm sau.
            */

            if (
                buyShares > 0
            ) {

                reinvestLots.push({

                    yearBought:
                        year,

                    shares:
                        buyShares,

                    price:
                        currentTargetPrice

                });

            }


            totalNewShares +=
                buyShares;


            totalReinvestMoney +=
                purchaseMoney;


            totalTargetDividendUsed +=
                yearlyTargetDividend;

        }


        /* ==========================================
           CP ĐÍCH CUỐI NĂM
        ========================================== */

        const reinvestSharesEnd =
            reinvestLots.reduce(
                (
                    sum,
                    lot
                ) =>
                    sum +
                    lot.shares,
                0
            );


        /* ==========================================
           TỔNG CP
        ========================================== */

        const totalSharesEnd =
            fixedSourceShares +
            reinvestSharesEnd;


        /* ==========================================
           GIÁ TRỊ CP NGUỒN
        ========================================== */

        const sourceValue =
            fixedSourceShares *
            currentSourcePrice;


        /* ==========================================
           GIÁ TRỊ CP ĐÍCH
        ========================================== */

        const targetValue =
            reinvestSharesEnd *
            currentTargetPrice;


        /* ==========================================
           GIÁ TRỊ CỔ PHIẾU
        ========================================== */

        const stockValue =
            sourceValue +
            targetValue;


        /* ==========================================
           TỔNG TÀI SẢN
        ========================================== */

        const totalValue =
            stockValue +
            cash;


        const holdingActive =
            year <= holdingYears;


        rows.push({

            year,

            sourceShares:
                fixedSourceShares,

            sourceDividend:
                yearlySourceDividend,

            reinvestSharesStart,

            targetDividend:
                yearlyTargetDividend,

            yearlyDividend,

            contribution,

            interest:
                yearlyInterest,

            sourcePrice:
                currentSourcePrice,

            targetPrice:
                currentTargetPrice,

            purchaseMoney,

            buyShares,

            reinvestSharesEnd,

            totalSharesEnd,

            sourceValue,

            targetValue,

            stockValue,

            cash,

            totalValue,

            holdingActive

        });

    }


    const finalRow =
        rows.length
            ? rows[rows.length - 1]
            : null;


    return {

        rows,

        sourceShares:
            fixedSourceShares,

        finalSourceShares:
            fixedSourceShares,

        finalReinvestShares:
            finalRow
                ? finalRow.reinvestSharesEnd
                : 0,

        finalShares:
            finalRow
                ? finalRow.totalSharesEnd
                : fixedSourceShares,

        totalSourceDividend,

        totalTargetDividend,

        totalDividend,

        totalContribution,

        totalReinvestMoney,

        totalNewShares,

        totalInterest,

        finalCash:
            finalRow
                ? finalRow.cash
                : cash,

        finalSourceValue:
            finalRow
                ? finalRow.sourceValue
                : 0,

        finalTargetValue:
            finalRow
                ? finalRow.targetValue
                : 0,

        finalStockValue:
            finalRow
                ? finalRow.stockValue
                : 0,

        finalTotalValue:
            finalRow
                ? finalRow.totalValue
                : cash

    };

}


/* ==================================================
   READ PROJECTION INPUT
================================================== */

function getProjectionInputs() {

    return {

        source:
            document.getElementById(
                "projectionSource"
            ).value
                .trim()
                .toUpperCase(),

        target:
            document.getElementById(
                "projectionTarget"
            ).value
                .trim()
                .toUpperCase(),

        shares:
            Number(
                document.getElementById(
                    "projectionShares"
                ).value
            ) || 0,

        sourcePrice:
            Number(
                document.getElementById(
                    "projectionSourcePrice"
                ).value
            ) || 0,

        targetPrice:
            Number(
                document.getElementById(
                    "projectionTargetPrice"
                ).value
            ) || 0,

        monthlyMoney:
            Number(
                document.getElementById(
                    "projectionMonthlyMoney"
                ).value
            ) || 0,

        reinvestPercent:
            Number(
                document.getElementById(
                    "projectionReinvest"
                ).value
            ) || 0,

        cashInterest:
            Number(
                document.getElementById(
                    "projectionCashInterest"
                ).value
            ) || 0,

        years:
            Number(
                document.getElementById(
                    "projectionYears"
                ).value
            ) || 1,

        contributionYears:
            Number(
                document.getElementById(
                    "projectionContributionYears"
                ).value
            ) || 0,

        reinvestYears:
            Number(
                document.getElementById(
                    "projectionReinvestYears"
                ).value
            ) || 0,

        holdingYears:
            Number(
                document.getElementById(
                    "projectionHoldingYears"
                ).value
            ) || 1,

        sourcePriceGrowth:
            Number(
                document.getElementById(
                    "projectionSourcePriceGrowth"
                ).value
            ) || 0,

        targetPriceGrowth:
            Number(
                document.getElementById(
                    "projectionTargetPriceGrowth"
                ).value
            ) || 0,

        sourceWeak:
            Number(
                document.getElementById(
                    "sourceScenarioWeak"
                ).value
            ) || 0,

        sourceMedium:
            Number(
                document.getElementById(
                    "sourceScenarioMedium"
                ).value
            ) || 0,

        sourceHigh:
            Number(
                document.getElementById(
                    "sourceScenarioHigh"
                ).value
            ) || 0,

        targetWeak:
            Number(
                document.getElementById(
                    "targetScenarioWeak"
                ).value
            ) || 0,

        targetMedium:
            Number(
                document.getElementById(
                    "targetScenarioMedium"
                ).value
            ) || 0,

        targetHigh:
            Number(
                document.getElementById(
                    "targetScenarioHigh"
                ).value
            ) || 0

    };

}


/* ==================================================
   RUN PROJECTION
================================================== */

function runDividendProjection() {

    const input =
        getProjectionInputs();


    if (
        !input.source
    ) {

        alert(
            "Hãy nhập mã cổ phiếu nguồn."
        );

        return;

    }


    if (
        !input.target
    ) {

        alert(
            "Hãy nhập mã cổ phiếu tái đầu tư."
        );

        return;

    }


    if (
        input.shares <= 0
    ) {

        alert(
            "CP nguồn ban đầu phải lớn hơn 0."
        );

        return;

    }


    if (
        input.sourcePrice <= 0
    ) {

        alert(
            "Giá CP nguồn phải lớn hơn 0."
        );

        return;

    }


    if (
        input.targetPrice <= 0
    ) {

        alert(
            "Giá CP tái đầu tư phải lớn hơn 0."
        );

        return;

    }


    const baseOptions = {

        sourceShares:
            input.shares,

        sourcePrice:
            input.sourcePrice,

        targetPrice:
            input.targetPrice,

        sourcePriceGrowth:
            input.sourcePriceGrowth,

        targetPriceGrowth:
            input.targetPriceGrowth,

        monthlyMoney:
            input.monthlyMoney,

        reinvestPercent:
            input.reinvestPercent,

        cashInterest:
            input.cashInterest,

        years:
            input.years,

        contributionYears:
            input.contributionYears,

        reinvestYears:
            input.reinvestYears,

        holdingYears:
            input.holdingYears,

        /*
           Giả định tốc độ tăng cổ tức
           của nguồn và đích giống nhau.

           Có thể tách riêng sau nếu muốn.
        */

        dividendGrowth:
            3,

        targetDividendGrowth:
            3,

        initialCash:
            0

    };


    const weakResult =
        calculateProjectionScenario({

            ...baseOptions,

            sourceDividend:
                input.sourceWeak,

            targetDividend:
                input.targetWeak

        });


    const mediumResult =
        calculateProjectionScenario({

            ...baseOptions,

            sourceDividend:
                input.sourceMedium,

            targetDividend:
                input.targetMedium

        });


    const highResult =
        calculateProjectionScenario({

            ...baseOptions,

            sourceDividend:
                input.sourceHigh,

            targetDividend:
                input.targetHigh

        });


    renderProjectionSummary(
        mediumResult,
        input.source,
        input.target
    );


    renderScenarioSummary({

        weak:
            weakResult,

        medium:
            mediumResult,

        high:
            highResult

    });


    renderProjectionTable(
        mediumResult,
        input.source,
        input.target,
        input
    );

}


/* ==================================================
   SUMMARY
================================================== */

function renderProjectionSummary(
    result,
    source,
    target
) {

    const element =
        document.getElementById(
            "projectionSummary"
        );


    element.innerHTML = `

        <div class="projection-stat">

            <span>
                CP nguồn ${escapeHTML(source)}
            </span>

            <strong>
                ${projectionNumber(
                    result.finalSourceShares
                )}
            </strong>

        </div>


        <div class="projection-stat">

            <span>
                CP tái đầu tư ${escapeHTML(target)}
            </span>

            <strong>
                ${projectionNumber(
                    result.finalReinvestShares
                )}
            </strong>

        </div>


        <div class="projection-stat">

            <span>
                Tổng CP
            </span>

            <strong>
                ${projectionNumber(
                    result.finalShares
                )}
            </strong>

        </div>


        <div class="projection-stat">

            <span>
                Cổ tức ${escapeHTML(source)}
            </span>

            <strong>
                ${projectionMoney(
                    result.totalSourceDividend
                )}
            </strong>

        </div>


        <div class="projection-stat">

            <span>
                Cổ tức ${escapeHTML(target)}
            </span>

            <strong>
                ${projectionMoney(
                    result.totalTargetDividend
                )}
            </strong>

        </div>


        <div class="projection-stat">

            <span>
                Tổng cổ tức
            </span>

            <strong>
                ${projectionMoney(
                    result.totalDividend
                )}
            </strong>

        </div>


        <div class="projection-stat">

            <span>
                Tiền nạp thêm
            </span>

            <strong>
                ${projectionMoney(
                    result.totalContribution
                )}
            </strong>

        </div>


        <div class="projection-stat">

            <span>
                Tiền dùng mua ${escapeHTML(target)}
            </span>

            <strong>
                ${projectionMoney(
                    result.totalReinvestMoney
                )}
            </strong>

        </div>


        <div class="projection-stat">

            <span>
                ${escapeHTML(target)}
                mua thêm
            </span>

            <strong>
                ${projectionNumber(
                    result.totalNewShares
                )}
            </strong>

        </div>


        <div class="projection-stat">

            <span>
                Lãi tiền mặt
            </span>

            <strong>
                ${projectionMoney(
                    result.totalInterest
                )}
            </strong>

        </div>


        <div class="projection-stat">

            <span>
                Tiền dư cuối kỳ
            </span>

            <strong>
                ${projectionMoney(
                    result.finalCash
                )}
            </strong>

        </div>


        <div class="projection-stat">

            <span>
                Giá trị ${escapeHTML(source)}
            </span>

            <strong>
                ${projectionMoney(
                    result.finalSourceValue
                )}
            </strong>

        </div>


        <div class="projection-stat">

            <span>
                Giá trị ${escapeHTML(target)}
            </span>

            <strong>
                ${projectionMoney(
                    result.finalTargetValue
                )}
            </strong>

        </div>


        <div class="projection-stat">

            <span>
                Tổng tài sản
            </span>

            <strong>
                ${projectionMoney(
                    result.finalTotalValue
                )}
            </strong>

        </div>

    `;

}


/* ==================================================
   SCENARIOS
================================================== */

function scenarioCard(
    title,
    result,
    source,
    target
) {

    return `

        <div class="scenario-result">

            <h3>
                ${title}
            </h3>


            <p>
                CP nguồn ${escapeHTML(source)}:

                <b>
                    ${projectionNumber(
                        result.finalSourceShares
                    )}
                </b>
            </p>


            <p>
                CP ${escapeHTML(target)}:

                <b>
                    ${projectionNumber(
                        result.finalReinvestShares
                    )}
                </b>
            </p>


            <p>
                Cổ tức ${escapeHTML(source)}:

                <b>
                    ${projectionMoney(
                        result.totalSourceDividend
                    )}
                </b>
            </p>


            <p>
                Cổ tức ${escapeHTML(target)}:

                <b>
                    ${projectionMoney(
                        result.totalTargetDividend
                    )}
                </b>
            </p>


            <p>
                Tổng cổ tức:

                <b>
                    ${projectionMoney(
                        result.totalDividend
                    )}
                </b>
            </p>


            <p>
                Tiền dùng mua ${escapeHTML(target)}:

                <b>
                    ${projectionMoney(
                        result.totalReinvestMoney
                    )}
                </b>
            </p>


            <p>
                ${escapeHTML(target)} mua thêm:

                <b>
                    ${projectionNumber(
                        result.totalNewShares
                    )}
                </b>
            </p>


            <p>
                Tiền dư:

                <b>
                    ${projectionMoney(
                        result.finalCash
                    )}
                </b>
            </p>


            <p>
                Giá trị ${escapeHTML(source)}:

                <b>
                    ${projectionMoney(
                        result.finalSourceValue
                    )}
                </b>
            </p>


            <p>
                Giá trị ${escapeHTML(target)}:

                <b>
                    ${projectionMoney(
                        result.finalTargetValue
                    )}
                </b>
            </p>


            <p>
                <strong>
                    Tổng tài sản:

                    ${projectionMoney(
                        result.finalTotalValue
                    )}
                </strong>
            </p>

        </div>

    `;

}


function renderScenarioSummary(
    scenarios
) {

    const element =
        document.getElementById(
            "projectionScenarioSummary"
        );


    const input =
        getProjectionInputs();


    element.innerHTML =

        scenarioCard(
            "🔴 Cổ tức yếu",
            scenarios.weak,
            input.source,
            input.target
        )

        +

        scenarioCard(
            "🟡 Cổ tức trung bình",
            scenarios.medium,
            input.source,
            input.target
        )

        +

        scenarioCard(
            "🟢 Cổ tức cao",
            scenarios.high,
            input.source,
            input.target
        );

}


/* ==================================================
   PROJECTION TABLE
================================================== */

function renderProjectionTable(
    result,
    source,
    target,
    input
) {

    const element =
        document.getElementById(
            "projectionTable"
        );


    element.innerHTML = `

        <table>

            <thead>

                <tr>

                    <th>Năm</th>

                    <th>
                        CP ${escapeHTML(source)}
                    </th>

                    <th>
                        Cổ tức ${escapeHTML(source)}
                    </th>

                    <th>
                        CP ${escapeHTML(target)}
                        đầu năm
                    </th>

                    <th>
                        Cổ tức ${escapeHTML(target)}
                    </th>

                    <th>
                        Tổng cổ tức
                    </th>

                    <th>
                        Tiền nạp
                    </th>

                    <th>
                        Lãi tiền mặt
                    </th>

                    <th>
                        Giá ${escapeHTML(source)}
                    </th>

                    <th>
                        Giá ${escapeHTML(target)}
                    </th>

                    <th>
                        Tiền mua ${escapeHTML(target)}
                    </th>

                    <th>
                        CP mua
                    </th>

                    <th>
                        CP ${escapeHTML(target)}
                        cuối năm
                    </th>

                    <th>
                        Tổng CP
                    </th>

                    <th>
                        Tiền dư
                    </th>

                    <th>
                        Giá trị ${escapeHTML(source)}
                    </th>

                    <th>
                        Giá trị ${escapeHTML(target)}
                    </th>

                    <th>
                        Tổng tài sản
                    </th>

                </tr>

            </thead>


            <tbody>

                ${result.rows.map(
                    row => `

                        <tr>

                            <td>
                                ${row.year}
                            </td>


                            <td>
                                ${projectionNumber(
                                    row.sourceShares
                                )}
                            </td>


                            <td>
                                ${projectionMoney(
                                    row.sourceDividend
                                )}
                            </td>


                            <td>
                                ${projectionNumber(
                                    row.reinvestSharesStart
                                )}
                            </td>


                            <td>
                                ${projectionMoney(
                                    row.targetDividend
                                )}
                            </td>


                            <td>
                                ${projectionMoney(
                                    row.yearlyDividend
                                )}
                            </td>


                            <td>
                                ${projectionMoney(
                                    row.contribution
                                )}
                            </td>


                            <td>
                                ${projectionMoney(
                                    row.interest
                                )}
                            </td>


                            <td>
                                ${projectionMoney(
                                    row.sourcePrice
                                )}
                            </td>


                            <td>
                                ${projectionMoney(
                                    row.targetPrice
                                )}
                            </td>


                            <td>
                                ${projectionMoney(
                                    row.purchaseMoney
                                )}
                            </td>


                            <td class="projection-buy">

                                ${
                                    row.buyShares > 0
                                        ? "+" +
                                          projectionNumber(
                                              row.buyShares
                                          )
                                        : "0"
                                }

                            </td>


                            <td>
                                ${projectionNumber(
                                    row.reinvestSharesEnd
                                )}
                            </td>


                            <td>
                                ${projectionNumber(
                                    row.totalSharesEnd
                                )}
                            </td>


                            <td class="projection-cash">

                                ${projectionMoney(
                                    row.cash
                                )}

                            </td>


                            <td>

                                ${projectionMoney(
                                    row.sourceValue
                                )}

                            </td>


                            <td>

                                ${projectionMoney(
                                    row.targetValue
                                )}

                            </td>


                            <td>

                                ${projectionMoney(
                                    row.totalValue
                                )}

                            </td>

                        </tr>

                    `
                ).join("")}

            </tbody>

        </table>


        <div class="projection-note">

            <strong>
                Logic dự phóng:
            </strong>

            <br><br>


            <b>
                ${escapeHTML(source)}
            </b>

            là cổ phiếu nguồn ban đầu.

            <br>

            CP nguồn được giữ riêng và
            không bị cộng với CP tái đầu tư.


            <br><br>


            <b>
                ${escapeHTML(source)}
                → cổ tức
            </b>

            <br>

            Cổ tức nguồn =
            CP nguồn × cổ tức/CP nguồn.


            <br><br>


            <b>
                Cổ tức ${escapeHTML(target)}
            </b>

            <br>

            Chỉ các lô
            ${escapeHTML(target)}
            đã mua từ năm trước
            mới được tính cổ tức.

            <br>

            ${escapeHTML(target)}
            vừa mua trong năm
            không nhận cổ tức của năm đó.


            <br><br>


            <b>
                Tiền nạp thêm
            </b>

            <br>

            ${projectionMoney(
                input.monthlyMoney
            )}
            / tháng trong
            ${input.contributionYears}
            năm đầu.


            <br><br>


            <b>
                Tái đầu tư
            </b>

            <br>

            ${
                input.reinvestPercent
            }%

            tiền khả dụng được dùng để
            mua ${escapeHTML(target)}.


            <br><br>


            <b>
                Mua theo lô
            </b>

            <br>

            Chỉ mua được bội số của
            <b>100 CP</b>.

            <br>

            Phần tiền chưa đủ một lô
            100 CP được giữ lại làm
            tiền mặt.


            <br><br>


            <b>
                Lãi tiền mặt
            </b>

            <br>

            Tiền còn dư tiếp tục sinh lãi
            theo mức:

            <b>
                ${input.cashInterest}%/năm
            </b>.


            <br><br>


            <b>
                Giá trị cuối kỳ
            </b>

            <br>

            Giá trị ${escapeHTML(source)}
            và giá trị ${escapeHTML(target)}
            được tính riêng bằng
            giá của từng mã.


            <br><br>


            Dự phóng hoàn toàn độc lập
            với danh mục thật.

        </div>

    `;

}


/* ==================================================
   TABS
================================================== */

function initTabs() {

    document
        .querySelectorAll(".tab")
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        document
                            .querySelectorAll(
                                ".tab"
                            )
                            .forEach(
                                item =>
                                    item.classList
                                        .remove(
                                            "active"
                                        )
                            );


                        document
                            .querySelectorAll(
                                ".tab-panel"
                            )
                            .forEach(
                                panel =>
                                    panel.classList
                                        .remove(
                                            "active"
                                        )
                            );


                        button.classList.add(
                            "active"
                        );


                        const panel =
                            document.getElementById(
                                button.dataset.tab
                            );


                        if (panel) {

                            panel.classList.add(
                                "active"
                            );

                        }

                    }
                );

            }
        );

}


/* ==================================================
   EVENTS
================================================== */

function initEvents() {


    const depositForm =
        document.getElementById(
            "depositForm"
        );


    if (depositForm) {

        depositForm.addEventListener(
            "submit",
            event => {

                event.preventDefault();

                try {

                    addDeposit(
                        event.target
                    );

                } catch (error) {

                    alert(
                        error.message
                    );

                }

            }
        );

    }


    const tradeForm =
        document.getElementById(
            "tradeForm"
        );


    if (tradeForm) {

        tradeForm.addEventListener(
            "submit",
            event => {

                event.preventDefault();

                try {

                    addTrade(
                        event.target
                    );

                } catch (error) {

                    alert(
                        error.message
                    );

                }

            }
        );


        const type =
            tradeForm.querySelector(
                '[name="type"]'
            );


        const source =
            tradeForm.querySelector(
                '[name="source"]'
            );


        type.addEventListener(
            "change",
            () => {

                if (
                    type.value === "sell"
                ) {

                    source.value =
                        "cash";

                    source.disabled =
                        true;

                } else {

                    source.disabled =
                        false;

                }

            }
        );

    }


    const dividendForm =
        document.getElementById(
            "dividendForm"
        );


    if (dividendForm) {

        dividendForm.addEventListener(
            "submit",
            event => {

                event.preventDefault();

                try {

                    addDividend(
                        event.target
                    );

                } catch (error) {

                    alert(
                        error.message
                    );

                }

            }
        );


        dividendForm
            .querySelector(
                '[name="type"]'
            )
            .addEventListener(
                "change",
                toggleDividendFields
            );

    }


    const settingsForm =
        document.getElementById(
            "settingsForm"
        );


    if (settingsForm) {

        settingsForm.addEventListener(
            "submit",
            event => {

                event.preventDefault();

                const form =
                    event.target;


                data.settings.fee =
                    Number(
                        form.fee.value
                    ) || 0;


                data.settings.custody =
                    Number(
                        form.custody.value
                    ) || 0;


                data.settings.interest =
                    Number(
                        form.interest.value
                    ) || 0;


                data.settings
                    .custodyEnabled =
                    form.custodyEnabled
                        .checked;


                saveData();

                toast(
                    "Đã lưu cài đặt."
                );

            }
        );

    }


    const restore =
        document.getElementById(
            "restoreInput"
        );


    if (restore) {

        restore.addEventListener(
            "change",
            async event => {

                const file =
                    event.target.files[0];


                if (file) {

                    await restoreJSON(
                        file
                    );

                }


                event.target.value =
                    "";

            }
        );

    }


    const projectionForm =
        document.getElementById(
            "projectionForm"
        );


    if (projectionForm) {

        projectionForm.addEventListener(
            "submit",
            event => {

                event.preventDefault();

                runDividendProjection();

            }
        );

    }

}


/* ==================================================
   DATES
================================================== */

function initDates() {

    const selectors = [

        '#depositForm [name="date"]',

        '#tradeForm [name="date"]',

        '#dividendForm [name="recordDate"]',

        '#dividendForm [name="payDate"]',

        '#projectionStartDate'

    ];


    selectors.forEach(
        selector => {

            const input =
                document.querySelector(
                    selector
                );


            if (input) {

                input.value =
                    today();

            }

        }
    );

}


/* ==================================================
   START
================================================== */

function renderAll() {

    renderDashboard();

    renderPortfolio();

    renderTransactions();

    renderDividends();

    renderSettings();

}


document.addEventListener(
    "DOMContentLoaded",
    () => {

        initTabs();

        initEvents();

        initDates();

        toggleDividendFields();

        renderAll();

    }
);
