/*
====================================================
ĐẦU TƯ CỔ TỨC
APP.JS - BẢN HOÀN CHỈNH
====================================================

- Nạp tiền
- Mua / bán
- FIFO
- Phí giao dịch
- Phí lưu ký
- Cổ tức tiền mặt
- Cổ tức cổ phiếu
- Cổ phiếu thưởng
- Ví cổ tức
- Lãi tiền mặt tính theo ngày
- Backup / Restore
- Dự phóng
- 3 kịch bản cổ tức:
  Yếu / Trung bình / Cao
- Tiền dư chuyển sang năm sau
- Mua theo lô 100 CP
- Không ảnh hưởng danh mục thật
====================================================
*/


/* ==================================================
   STORAGE
================================================== */

const STORAGE_KEY = "dautucotuc_v2";


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

    if (!start || !end) {
        return 0;
    }

    const a =
        new Date(start + "T00:00:00");

    const b =
        new Date(end + "T00:00:00");

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

            base[key] = source[key];

        }

    }

    return base;

}


/* ==================================================
   LOAD / SAVE
================================================== */

function loadData() {

    try {

        const saved =
            localStorage.getItem(
                STORAGE_KEY
            );

        if (!saved) {

            return clone(DEFAULT_DATA);

        }

        const parsed =
            JSON.parse(saved);

        return mergeData(
            clone(DEFAULT_DATA),
            parsed
        );

    } catch (error) {

        console.error(
            "Load error:",
            error
        );

        return clone(DEFAULT_DATA);

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

    if (!el) {
        return;
    }

    el.textContent =
        message;

    el.classList.add(
        "show"
    );

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
   TRADING FEE
================================================== */

function calculateTradingFee(
    amount
) {

    const feePercent =
        Number(
            data.settings.fee
        ) || 0;

    return (
        Number(amount) || 0
    ) *
    feePercent /
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

    const date =
        form.date.value ||
        today();

    if (amount <= 0) {

        throw new Error(
            "Số tiền nạp phải lớn hơn 0."
        );

    }

    data.deposits.push({

        id:
            uid("deposit"),

        date,

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
   SYMBOLS
================================================== */

function getSymbols() {

    const symbols =
        new Set();

    data.transactions.forEach(
        transaction => {

            if (
                transaction.symbol
            ) {

                symbols.add(
                    transaction.symbol
                );

            }

        }
    );

    data.dividends.forEach(
        dividend => {

            if (
                dividend.symbol
            ) {

                symbols.add(
                    dividend.symbol
                );

            }

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
                Number(d.receivedQty) > 0
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

            const dateCompare =
                String(a.date)
                    .localeCompare(
                        String(b.date)
                    );

            if (
                dateCompare !== 0
            ) {

                return dateCompare;

            }

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
                    ) || 0,

                source:
                    "buy"

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

                price: 0,

                source:
                    "dividend"

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
                ) {

                    break;

                }


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
                    `Không đủ ${symbol} để bán ${number(event.qty)} CP.`
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


/* ==================================================
   HOLDINGS
================================================== */

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

                    eventType:
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

                    eventType:
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
            event.eventType === "buy"
        ) {

            lots.push({

                qty:
                    event.qty

            });

        }


        else if (
            event.eventType ===
            "stockDividend"
        ) {

            lots.push({

                qty:
                    event.qty

            });

        }


        else if (
            event.eventType === "sell"
        ) {

            let remaining =
                event.qty;


            for (
                const lot of lots
            ) {

                if (
                    remaining <= 0
                ) {

                    break;

                }


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
        deposit => {

            cash +=
                Number(
                    deposit.amount
                ) || 0;

        }
    );


    data.transactions.forEach(
        transaction => {

            if (
                transaction.type === "buy" &&
                transaction.source === "cash"
            ) {

                cash -=
                    Number(
                        transaction.total
                    ) || 0;

            }


            if (
                transaction.type === "sell"
            ) {

                cash +=
                    Number(
                        transaction.net
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
==================================================

   Lãi tiền mặt:
   - Tính theo ngày
   - Dựa trên số dư tiền mặt
   - Lãi suất chỉnh được
================================================== */

function calculateCashInterest() {

    const events = [];


    data.deposits.forEach(
        deposit => {

            events.push({

                date:
                    deposit.date,

                delta:
                    Number(
                        deposit.amount
                    ) || 0

            });

        }
    );


    data.transactions.forEach(
        transaction => {

            if (
                transaction.type === "buy" &&
                transaction.source === "cash"
            ) {

                events.push({

                    date:
                        transaction.date,

                    delta:
                        -(
                            Number(
                                transaction.total
                            ) || 0
                        )

                });

            }


            if (
                transaction.type === "sell"
            ) {

                events.push({

                    date:
                        transaction.date,

                    delta:
                        Number(
                            transaction.net
                        ) || 0

                });

            }

        }
    );


    if (
        events.length === 0
    ) {

        return 0;

    }


    events.sort(
        (a, b) =>
            String(a.date)
                .localeCompare(
                    String(b.date)
                )
    );


    let balance = 0;

    let interest = 0;

    let previousDate =
        events[0].date;


    for (
        const event of events
    ) {

        if (
            event.date >
            previousDate
        ) {

            const days =
                daysBetween(
                    previousDate,
                    event.date
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
                days /
                365;

        }


        balance +=
            event.delta;


        previousDate =
            event.date;

    }


    const finalDays =
        daysBetween(
            previousDate,
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
   CUSTODY FEE
================================================== */

function calculateCustodyFee() {

    if (
        !data.settings.custodyEnabled
    ) {

        return 0;

    }


    let total = 0;

    const endDate =
        today();


    for (
        const symbol of getSymbols()
    ) {

        const lots =
            getHoldingLots(
                symbol
            );


        for (
            const lot of lots
        ) {

            const days =
                daysBetween(
                    lot.date,
                    endDate
                );


            total +=
                lot.qty *
                (
                    Number(
                        data.settings.custody
                    ) || 0
                ) *
                days;

        }

    }


    return total;

}


/* ==================================================
   PORTFOLIO
================================================== */

function getPortfolio() {

    const result = [];


    for (
        const symbol of getSymbols()
    ) {

        const lots =
            getHoldingLots(
                symbol
            );


        const quantity =
            lots.reduce(
                (sum, lot) =>
                    sum + lot.qty,
                0
            );


        const cost =
            lots.reduce(
                (sum, lot) =>
                    sum +
                    lot.qty *
                    lot.price,
                0
            );


        const averageCost =
            quantity > 0
                ? cost / quantity
                : 0;


        const transactionFees =
            data.transactions
                .filter(
                    t =>
                        t.symbol === symbol
                )
                .reduce(
                    (sum, t) =>
                        sum +
                        (
                            Number(t.fee) || 0
                        ),
                    0
                );


        const cashDividend =
            data.dividends
                .filter(
                    d =>
                        d.symbol === symbol &&
                        d.type === "cash"
                )
                .reduce(
                    (sum, d) =>
                        sum +
                        (
                            Number(
                                d.cashTotal
                            ) || 0
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
                    (sum, d) =>
                        sum +
                        (
                            Number(
                                d.receivedQty
                            ) || 0
                        ),
                    0
                );


        result.push({

            symbol,

            lots,

            quantity,

            cost,

            averageCost,

            transactionFees,

            cashDividend,

            stockDividend

        });

    }


    return result.filter(
        item =>
            item.quantity > 0 ||
            item.cashDividend > 0 ||
            item.stockDividend > 0
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

    const quantity =
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
        quantity <= 0 ||
        price < 0
    ) {

        throw new Error(
            "Kiểm tra lại thông tin giao dịch."
        );

    }


    /*
       Khi bán thì nguồn tiền
       luôn quay về tiền mặt.
    */

    if (
        type === "sell"
    ) {

        source = "cash";

    }


    const value =
        quantity *
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
            source === "cash"
        ) {

            const cash =
                calculateCash();


            if (
                cash <
                total - 0.000001
            ) {

                throw new Error(
                    "Không đủ tiền mặt."
                );

            }

        }


        if (
            source === "dividend"
        ) {

            const wallet =
                calculateDividendWallet();


            if (
                wallet <
                total - 0.000001
            ) {

                throw new Error(
                    "Không đủ tiền trong ví cổ tức."
                );

            }

        }


        data.transactions.push({

            id:
                uid("tx"),

            type:
                "buy",

            date,

            symbol,

            qty:
                quantity,

            price,

            fee,

            total,

            net:
                -total,

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
            holding <
            quantity - 0.000001
        ) {

            throw new Error(
                `Không đủ ${symbol} để bán.`
            );

        }


        const net =
            value -
            fee;


        const lots =
            getHoldingLots(
                symbol
            );


        let remaining =
            quantity;

        let costBasis = 0;


        for (
            const lot of lots
        ) {

            if (
                remaining <= 0
            ) {

                break;

            }


            const take =
                Math.min(
                    lot.qty,
                    remaining
                );


            costBasis +=
                take *
                lot.price;

            remaining -=
                take;

        }


        data.transactions.push({

            id:
                uid("tx"),

            type:
                "sell",

            date,

            symbol,

            qty:
                quantity,

            price,

            fee,

            total:
                value,

            net,

            source:
                "cash",

            costBasis,

            realized:
                net - costBasis,

            note:
                form.note.value.trim()

        });

    }


    try {

        for (
            const s of getSymbols()
        ) {

            getHoldingLots(s);

        }

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
   ADD DIVIDEND
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
            ) + 0.000001
        );


    if (
        eligible <= 0
    ) {

        throw new Error(
            `Không có ${symbol} đủ điều kiện nhận cổ tức tại ngày chốt quyền.`
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

        const cashPerShare =
            Number(
                form.cashPerShare.value
            );


        if (
            cashPerShare <= 0
        ) {

            throw new Error(
                "Cổ tức tiền / CP phải lớn hơn 0."
            );

        }


        dividend.cashPerShare =
            cashPerShare;

        dividend.cashTotal =
            eligible *
            cashPerShare;

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

    form.cashPerShare.value =
        0;

    toggleDividendFields();

    toast(
        "Đã lưu quyền cổ tức."
    );

}


/* ==================================================
   DELETE
================================================== */

function deleteTransaction(id) {

    const backup =
        clone(data);


    const index =
        data.transactions.findIndex(
            t =>
                t.id === id
        );


    if (
        index === -1
    ) {

        return;

    }


    data.transactions.splice(
        index,
        1
    );


    try {

        for (
            const symbol of getSymbols()
        ) {

            getHoldingLots(
                symbol
            );

        }


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
    ) {

        return;

    }


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
            (sum, d) =>
                sum +
                (
                    Number(d.amount) || 0
                ),
            0
        );


    const cash =
        calculateCash();


    const dividendWallet =
        calculateDividendWallet();


    const available =
        cash +
        dividendWallet;


    const invested =
        portfolio.reduce(
            (sum, item) =>
                sum + item.cost,
            0
        );


    const cashDividend =
        data.dividends
            .filter(
                d =>
                    d.type === "cash"
            )
            .reduce(
                (sum, d) =>
                    sum +
                    (
                        Number(
                            d.cashTotal
                        ) || 0
                    ),
                0
            );


    const interest =
        calculateCashInterest();


    const custody =
        calculateCustodyFee();


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
            money(dividendWallet)
        ],

        [
            "Tiền khả dụng",
            money(available)
        ],

        [
            "Vốn cổ phiếu",
            money(invested)
        ],

        [
            "Cổ tức tiền mặt",
            money(cashDividend)
        ],

        [
            "Lãi tiền mặt",
            money(interest)
        ],

        [
            "Phí lưu ký",
            money(custody)
        ]

    ];


    const dashboard =
        document.getElementById(
            "dashboard"
        );


    dashboard.innerHTML =
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

    const portfolio =
        getPortfolio();


    const element =
        document.getElementById(
            "portfolio"
        );


    if (
        portfolio.length === 0
    ) {

        element.innerHTML = `

            <div class="card">

                <div class="hint">
                    Chưa có cổ phiếu.
                    Hãy thêm giao dịch mua đầu tiên.
                </div>

            </div>

        `;

        return;

    }


    element.innerHTML =
        portfolio.map(
            item => `

                <div class="card stock-card">

                    <h3>
                        ${escapeHTML(
                            item.symbol
                        )}
                    </h3>

                    <div class="stock-meta">

                        <div class="kv">

                            <span>
                                Số CP
                            </span>

                            <b>
                                ${number(
                                    item.quantity
                                )}
                            </b>

                        </div>


                        <div class="kv">

                            <span>
                                Giá vốn BQ
                            </span>

                            <b>
                                ${money(
                                    item.averageCost
                                )}
                            </b>

                        </div>


                        <div class="kv">

                            <span>
                                Giá vốn còn lại
                            </span>

                            <b>
                                ${money(
                                    item.cost
                                )}
                            </b>

                        </div>


                        <div class="kv">

                            <span>
                                Số lô
                            </span>

                            <b>
                                ${item.lots.length}
                            </b>

                        </div>


                        <div class="kv">

                            <span>
                                Cổ tức tiền
                            </span>

                            <b>
                                ${money(
                                    item.cashDividend
                                )}
                            </b>

                        </div>


                        <div class="kv">

                            <span>
                                CP từ quyền
                            </span>

                            <b>
                                ${number(
                                    item.stockDividend
                                )}
                            </b>

                        </div>

                    </div>

                </div>

            `
        ).join("");

}


/* ==================================================
   TRANSACTION TABLE
================================================== */

function transactionTable(
    transactions
) {

    if (
        transactions.length === 0
    ) {

        return `

            <div class="card">

                <div class="hint">
                    Chưa có dữ liệu.
                </div>

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
                    transaction => `

                        <tr>

                            <td>
                                ${escapeHTML(
                                    transaction.date
                                )}
                            </td>

                            <td class="${
                                transaction.type === "sell"
                                    ? "red"
                                    : "green"
                            }">

                                ${
                                    transaction.type === "buy"
                                        ? "MUA"
                                        : "BÁN"
                                }

                            </td>

                            <td>
                                ${escapeHTML(
                                    transaction.symbol
                                )}
                            </td>

                            <td>
                                ${number(
                                    transaction.qty
                                )}
                            </td>

                            <td>
                                ${money(
                                    transaction.price
                                )}
                            </td>

                            <td>
                                ${money(
                                    transaction.fee
                                )}
                            </td>

                            <td>
                                ${money(
                                    transaction.total
                                )}
                            </td>

                            <td>

                                ${
                                    transaction.type === "buy"
                                        ? (
                                            transaction.source === "dividend"
                                                ? "Ví cổ tức"
                                                : "Tiền mặt"
                                        )
                                        : "—"
                                }

                            </td>

                            <td>

                                <button
                                    class="action"
                                    onclick="deleteTransaction('${transaction.id}')"
                                >
                                    Xóa
                                </button>

                            </td>

                        </tr>

                    `
                ).join("")}

            </tbody>

        </table>

    `;

}


/* ==================================================
   TRANSACTIONS
================================================== */

function renderTransactions() {

    document.getElementById(
        "transactions"
    ).innerHTML =
        transactionTable(
            data.transactions
        );


    document.getElementById(
        "recent"
    ).innerHTML =
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


/* ==================================================
   DIVIDENDS
================================================== */

function renderDividends() {

    const element =
        document.getElementById(
            "dividends"
        );


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


    if (
        dividends.length === 0
    ) {

        element.innerHTML = `

            <div class="card">

                <div class="hint">
                    Chưa có lịch sử cổ tức.
                </div>

            </div>

        `;

        return;

    }


    element.innerHTML = `

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
                    dividend => {

                        let result;


                        if (
                            dividend.type === "cash"
                        ) {

                            result =
                                money(
                                    dividend.cashTotal
                                );

                        } else {

                            result =
                                `${number(
                                    dividend.receivedQty
                                )} CP (${dividend.ratioBase}:${dividend.ratioNew})`;

                        }


                        return `

                            <tr>

                                <td>
                                    ${escapeHTML(
                                        dividend.recordDate
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        dividend.payDate
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        dividend.symbol
                                    )}
                                </td>

                                <td>

                                    ${
                                        dividend.type === "cash"
                                            ? "Tiền mặt"
                                            : dividend.type === "stock"
                                                ? "Cổ tức CP"
                                                : "CP thưởng"
                                    }

                                </td>

                                <td>
                                    ${number(
                                        dividend.eligible
                                    )}
                                </td>

                                <td>
                                    ${result}
                                </td>

                                <td>

                                    <button
                                        class="action"
                                        onclick="deleteDividend('${dividend.id}')"
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


    if (!form) {
        return;
    }


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
   DIVIDEND FORM FIELDS
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


    if (!cash || !stock) {
        return;
    }


    if (
        type === "cash"
    ) {

        cash.style.display =
            "block";

        stock.style.display =
            "none";

    } else {

        cash.style.display =
            "none";

        stock.style.display =
            "block";

    }

}


/* ==================================================
   RESET TRADE
================================================== */

function resetTradeForm() {

    const form =
        document.getElementById(
            "tradeForm"
        );


    form.reset();

    form.date.value =
        today();

    form.type.value =
        "buy";

    form.source.value =
        "cash";

}


/* ==================================================
   OPEN TRADE
================================================== */

function openTrade(type) {

    const tab =
        document.querySelector(
            '[data-tab="trade"]'
        );


    if (tab) {
        tab.click();
    }


    const form =
        document.getElementById(
            "tradeForm"
        );


    if (form) {

        form.type.value =
            type;

        if (
            type === "sell"
        ) {

            form.source.value =
                "cash";

        }

    }

}


/* ==================================================
   BACKUP
================================================== */

function backupJSON() {

    const backup = {

        version: 2,

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


    setTimeout(
        () =>
            URL.revokeObjectURL(url),
        1000
    );


    toast(
        "Đã xuất backup JSON."
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
            !restored ||
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


        for (
            const symbol of getSymbols()
        ) {

            getHoldingLots(
                symbol
            );

        }


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
            "Xóa TOÀN BỘ dữ liệu?\n\nHãy backup trước nếu cần."
        )
    ) {

        return;

    }


    data =
        clone(
            DEFAULT_DATA
        );


    saveData();

    toast(
        "Đã xóa toàn bộ dữ liệu."
    );

}


/* ==================================================
   PROJECTION HELPERS
================================================== */

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


/* ==================================================
   PROJECTION ENGINE
==================================================

   QUAN TRỌNG:

   - Không lưu vào danh mục thật
   - Không tạo transaction
   - Tiền dư chuyển sang năm sau
   - Lãi tiền mặt tính theo ngày
   - Mua theo lô 100 CP
================================================== */

function calculateProjectionScenario(
    options
) {

    let shares =
        Math.max(
            0,
            Number(options.shares) || 0
        );


    const price =
        Math.max(
            0,
            Number(options.price) || 0
        );


    const dividend =
        Math.max(
            0,
            Number(options.dividend) || 0
        );


    const dividendGrowth =
        Number(
            options.dividendGrowth
        ) || 0;


    const priceGrowth =
        Number(
            options.priceGrowth
        ) || 0;


    const monthlyMoney =
        Math.max(
            0,
            Number(options.monthlyMoney) || 0
        );


    const reinvestPercent =
        Math.min(
            100,
            Math.max(
                0,
                Number(
                    options.reinvestPercent
                ) || 0
            )
        );


    const cashInterest =
        Math.max(
            0,
            Number(options.cashInterest) || 0
        );


    const years =
        Math.max(
            1,
            Math.floor(
                Number(options.years) || 1
            )
        );


    /*
       Tiền mặt ban đầu.

       Không có mã tái đầu tư:
       vẫn tính được tiền dư.
    */

    let cash =
        Math.max(
            0,
            Number(options.initialCash) || 0
        );


    let totalDividend = 0;

    let totalContribution = 0;

    let totalReinvest = 0;

    let totalNewShares = 0;

    let totalInterest = 0;


    const rows = [];


    for (
        let year = 1;
        year <= years;
        year++
    ) {

        const startShares =
            shares;


        /*
           Giá cổ phiếu năm đó
        */

        const currentPrice =
            price *
            Math.pow(
                1 +
                priceGrowth / 100,
                year - 1
            );


        /*
           Cổ tức/CP năm đó
        */

        const dividendPerShare =
            dividend *
            Math.pow(
                1 +
                dividendGrowth / 100,
                year - 1
            );


        /*
           Cổ tức nhận trong năm
        */

        const dividendMoney =
            startShares *
            dividendPerShare;


        /*
           Tiền nạp trong năm
        */

        const contribution =
            monthlyMoney *
            12;


        /*
           Thời gian giữa các lần
           phát sinh tiền.

           Mô phỏng đơn giản:
           tiền có trong năm được
           hưởng lãi trung bình khoảng
           nửa năm.

           Nhưng để tính theo ngày,
           ta mô phỏng dòng tiền tháng.
        */

        let yearlyInterest = 0;


        /*
           Tiền đầu năm
        */

        let workingCash =
            cash;


        /*
           Lãi trên tiền đầu năm
           trong 365 ngày.
        */

        yearlyInterest +=
            workingCash *
            cashInterest /
            100 /
            365 *
            365;


        /*
           Tiền nạp từng tháng.
        */

        for (
            let month = 1;
            month <= 12;
            month++
        ) {

            const monthlyContribution =
                monthlyMoney;


            /*
               Mỗi khoản nạp được
               hưởng lãi số ngày còn lại
               của năm.

               Tháng 1 ~ 11 tháng
               Tháng 12 ~ 0 tháng.
            */

            const daysRemaining =
                Math.max(
                    0,
                    Math.round(
                        365 *
                        (
                            12 - month
                        ) /
                        12
                    )
                );


            yearlyInterest +=
                monthlyContribution *
                cashInterest /
                100 /
                365 *
                daysRemaining;

        }


        /*
           Cộng lãi vào tiền mặt.
        */

        cash +=
            yearlyInterest;


        totalInterest +=
            yearlyInterest;


        /*
           Cộng cổ tức.
        */

        cash +=
            dividendMoney;


        totalDividend +=
            dividendMoney;


        /*
           Cộng tiền nạp.
        */

        cash +=
            contribution;


        totalContribution +=
            contribution;


        /*
           Phần được phép tái đầu tư.
        */

        const availableForReinvest =
            cash *
            reinvestPercent /
            100;


        /*
           Nếu không có mã nhận:
           không mua CP,
           toàn bộ vẫn nằm trong tiền mặt.
        */

        let buyShares = 0;

        let purchaseMoney = 0;


        if (
            options.target &&
            options.target.trim() !== "" &&
            currentPrice > 0
        ) {

            const possible =
                Math.floor(
                    availableForReinvest /
                    currentPrice
                );


            /*
               Chỉ mua lô 100 CP.
            */

            buyShares =
                Math.floor(
                    possible / 100
                ) *
                100;


            purchaseMoney =
                buyShares *
                currentPrice;


            cash -=
                purchaseMoney;


            shares +=
                buyShares;


            totalNewShares +=
                buyShares;


            totalReinvest +=
                purchaseMoney;

        }


        /*
           Nếu chỉ tái đầu tư một phần:
           phần còn lại vẫn là tiền mặt.
        */

        const endValue =
            shares *
            currentPrice;


        rows.push({

            year,

            startShares,

            dividendPerShare,

            dividendMoney,

            contribution,

            interest:
                yearlyInterest,

            currentPrice,

            purchaseMoney,

            buyShares,

            endShares:
                shares,

            cash,

            endValue,

            totalValue:
                endValue + cash

        });

    }


    return {

        rows,

        finalShares:
            shares,

        totalDividend,

        totalContribution,

        totalReinvest,

        totalNewShares,

        totalInterest,

        finalCash:
            cash,

        finalStockValue:
            rows.length
                ? rows[rows.length - 1]
                    .endValue
                : 0,

        finalTotalValue:
            rows.length
                ? rows[rows.length - 1]
                    .totalValue
                : cash

    };

}


/* ==================================================
   RUN PROJECTION
================================================== */

function runDividendProjection() {

    const source =
        document.getElementById(
            "projectionSource"
        ).value
            .trim()
            .toUpperCase();


    const target =
        document.getElementById(
            "projectionTarget"
        ).value
            .trim()
            .toUpperCase();


    const shares =
        Number(
            document.getElementById(
                "projectionShares"
            ).value
        ) || 0;


    const price =
        Number(
            document.getElementById(
                "projectionPrice"
            ).value
        ) || 0;


    const dividendGrowth =
        Number(
            document.getElementById(
                "projectionDividendGrowth"
            ).value
        ) || 0;


    const priceGrowth =
        Number(
            document.getElementById(
                "projectionPriceGrowth"
            ).value
        ) || 0;


    const monthlyMoney =
        Number(
            document.getElementById(
                "projectionMonthlyMoney"
            ).value
        ) || 0;


    const reinvestPercent =
        Number(
            document.getElementById(
                "projectionReinvest"
            ).value
        ) || 0;


    const cashInterest =
        Number(
            document.getElementById(
                "projectionCashInterest"
            ).value
        ) || 0;


    const years =
        Number(
            document.getElementById(
                "projectionYears"
            ).value
        ) || 1;


    const weak =
        Number(
            document.getElementById(
                "scenarioWeak"
            ).value
        ) || 0;


    const medium =
        Number(
            document.getElementById(
                "scenarioMedium"
            ).value
        ) || 0;


    const high =
        Number(
            document.getElementById(
                "scenarioHigh"
            ).value
        ) || 0;


    if (
        price <= 0
    ) {

        alert(
            "Giá cổ phiếu năm đầu phải lớn hơn 0."
        );

        return;

    }


    if (
        shares < 0
    ) {

        alert(
            "Số CP không hợp lệ."
        );

        return;

    }


    /*
       Chạy 3 kịch bản.
    */

    const scenarios = {

        weak:
            calculateProjectionScenario({

                shares,

                price,

                dividend:
                    weak,

                dividendGrowth,

                priceGrowth,

                monthlyMoney,

                reinvestPercent,

                cashInterest,

                years,

                target

            }),


        medium:
            calculateProjectionScenario({

                shares,

                price,

                dividend:
                    medium,

                dividendGrowth,

                priceGrowth,

                monthlyMoney,

                reinvestPercent,

                cashInterest,

                years,

                target

            }),


        high:
            calculateProjectionScenario({

                shares,

                price,

                dividend:
                    high,

                dividendGrowth,

                priceGrowth,

                monthlyMoney,

                reinvestPercent,

                cashInterest,

                years,

                target

            })

    };


    /*
       Hiển thị summary mặc định
       theo kịch bản trung bình.
    */

    renderProjectionSummary(
        scenarios.medium,
        target
    );


    renderScenarioSummary(
        scenarios,
        source,
        target
    );


    renderProjectionTable(
        scenarios.medium,
        source,
        target
    );

}


/* ==================================================
   PROJECTION SUMMARY
================================================== */

function renderProjectionSummary(
    result,
    target
) {

    const summary =
        document.getElementById(
            "projectionSummary"
        );


    summary.innerHTML = `

        <div class="projection-stat">

            <span>
                Mã nhận
            </span>

            <strong>
                ${escapeHTML(
                    target || "Giữ tiền mặt"
                )}
            </strong>

        </div>


        <div class="projection-stat">

            <span>
                CP cuối kỳ
            </span>

            <strong>
                ${projectionNumber(
                    result.finalShares
                )}
            </strong>

        </div>


        <div class="projection-stat">

            <span>
                Cổ tức tích lũy
            </span>

            <strong>
                ${projectionMoney(
                    result.totalDividend
                )}
            </strong>

        </div>


        <div class="projection-stat">

            <span>
                Tổng tái đầu tư
            </span>

            <strong>
                ${projectionMoney(
                    result.totalReinvest
                )}
            </strong>

        </div>


        <div class="projection-stat">

            <span>
                CP mua thêm
            </span>

            <strong>
                ${projectionNumber(
                    result.totalNewShares
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
                Tổng giá trị cuối kỳ
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
   SCENARIO SUMMARY
================================================== */

function renderScenarioSummary(
    scenarios,
    source,
    target
) {

    const element =
        document.getElementById(
            "projectionScenarioSummary"
        );


    element.innerHTML = `

        <div class="scenario-result">

            <h3>
                🔴 Cổ tức yếu
            </h3>

            <p>
                Cổ tức tích lũy:
                <b>
                    ${projectionMoney(
                        scenarios.weak.totalDividend
                    )}
                </b>
            </p>

            <p>
                CP cuối kỳ:
                <b>
                    ${projectionNumber(
                        scenarios.weak.finalShares
                    )}
                </b>
            </p>

            <p>
                Tiền dư:
                <b>
                    ${projectionMoney(
                        scenarios.weak.finalCash
                    )}
                </b>
            </p>

            <p>
                Tổng giá trị:
                <b>
                    ${projectionMoney(
                        scenarios.weak.finalTotalValue
                    )}
                </b>
            </p>

        </div>


        <div class="scenario-result">

            <h3>
                🟡 Cổ tức trung bình
            </h3>

            <p>
                Cổ tức tích lũy:
                <b>
                    ${projectionMoney(
                        scenarios.medium.totalDividend
                    )}
                </b>
            </p>

            <p>
                CP cuối kỳ:
                <b>
                    ${projectionNumber(
                        scenarios.medium.finalShares
                    )}
                </b>
            </p>

            <p>
                Tiền dư:
                <b>
                    ${projectionMoney(
                        scenarios.medium.finalCash
                    )}
                </b>
            </p>

            <p>
                Tổng giá trị:
                <b>
                    ${projectionMoney(
                        scenarios.medium.finalTotalValue
                    )}
                </b>
            </p>

        </div>


        <div class="scenario-result">

            <h3>
                🟢 Cổ tức cao
            </h3>

            <p>
                Cổ tức tích lũy:
                <b>
                    ${projectionMoney(
                        scenarios.high.totalDividend
                    )}
                </b>
            </p>

            <p>
                CP cuối kỳ:
                <b>
                    ${projectionNumber(
                        scenarios.high.finalShares
                    )}
                </b>
            </p>

            <p>
                Tiền dư:
                <b>
                    ${projectionMoney(
                        scenarios.high.finalCash
                    )}
                </b>
            </p>

            <p>
                Tổng giá trị:
                <b>
                    ${projectionMoney(
                        scenarios.high.finalTotalValue
                    )}
                </b>
            </p>

        </div>

    `;

}


/* ==================================================
   PROJECTION TABLE
================================================== */

function renderProjectionTable(
    result,
    source,
    target
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

                    <th>CP đầu năm</th>

                    <th>Cổ tức/CP</th>

                    <th>Cổ tức nhận</th>

                    <th>Tiền nạp</th>

                    <th>Lãi tiền mặt</th>

                    <th>Giá CP</th>

                    <th>Tiền tái đầu tư</th>

                    <th>CP mua</th>

                    <th>CP cuối năm</th>

                    <th>Tiền dư</th>

                    <th>Giá trị CP</th>

                    <th>Tổng giá trị</th>

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
                                    row.startShares
                                )}
                            </td>

                            <td>
                                ${projectionMoney(
                                    row.dividendPerShare
                                )}
                            </td>

                            <td>
                                ${projectionMoney(
                                    row.dividendMoney
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
                                    row.currentPrice
                                )}
                            </td>

                            <td>
                                ${projectionMoney(
                                    row.purchaseMoney
                                )}
                            </td>

                            <td class="projection-buy">
                                +${projectionNumber(
                                    row.buyShares
                                )}
                            </td>

                            <td>
                                ${projectionNumber(
                                    row.endShares
                                )}
                            </td>

                            <td class="projection-cash">
                                ${projectionMoney(
                                    row.cash
                                )}
                            </td>

                            <td>
                                ${projectionMoney(
                                    row.endValue
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

            <b>Quy tắc:</b>

            ${escapeHTML(
                source || "Không chọn mã nguồn"
            )}

            → 

            ${escapeHTML(
                target || "Không tái đầu tư CP"
            )}

            <br><br>

            Cổ tức được tính theo số CP
            đầu năm.

            Tiền nạp được cộng thêm
            ${number(
                Number(
                    document.getElementById(
                        "projectionMonthlyMoney"
                    ).value
                ) || 0
            )} đ/tháng.

            <br><br>

            Tiền mặt được tính lãi
            theo lãi suất:

            <b>
                ${Number(
                    document.getElementById(
                        "projectionCashInterest"
                    ).value
                ) || 0}%/năm
            </b>

            và tính theo số ngày.

            <br><br>

            Chỉ mua theo
            <b>lô 100 CP</b>.

            Tiền chưa đủ mua 100 CP
            được giữ lại và tiếp tục
            sinh lãi ở năm sau.

            <br><br>

            Dự phóng không tạo giao dịch
            thật và không lưu vào danh mục.

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
                            .querySelectorAll(".tab")
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


    /* NẠP TIỀN */

    document
        .getElementById(
            "depositForm"
        )
        .addEventListener(
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


    /* GIAO DỊCH */

    document
        .getElementById(
            "tradeForm"
        )
        .addEventListener(
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


    /* CỔ TỨC */

    document
        .getElementById(
            "dividendForm"
        )
        .addEventListener(
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


    /* ĐỔI LOẠI CỔ TỨC */

    document
        .querySelector(
            '#dividendForm [name="type"]'
        )
        .addEventListener(
            "change",
            toggleDividendFields
        );


    /* CÀI ĐẶT */

    document
        .getElementById(
            "settingsForm"
        )
        .addEventListener(
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
                    form
                        .custodyEnabled
                        .checked;


                saveData();


                toast(
                    "Đã lưu cài đặt."
                );

            }
        );


    /* RESTORE */

    document
        .getElementById(
            "restoreInput"
        )
        .addEventListener(
            "change",
            async event => {

                const file =
                    event.target.files[0];


                if (!file) {
                    return;
                }


                await restoreJSON(
                    file
                );


                event.target.value =
                    "";

            }
        );


    /* DỰ PHÓNG */

    document
        .getElementById(
            "projectionForm"
        )
        .addEventListener(
            "submit",
            event => {

                event.preventDefault();

                runDividendProjection();

            }
        );


    /* MUA / BÁN */

    document
        .querySelector(
            '#tradeForm [name="type"]'
        )
        .addEventListener(
            "change",
            event => {

                const source =
                    document.querySelector(
                        '#tradeForm [name="source"]'
                    );


                if (
                    event.target.value === "sell"
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


/* ==================================================
   DEFAULT DATES
================================================== */

function initDates() {

    const selectors = [

        '#depositForm [name="date"]',

        '#tradeForm [name="date"]',

        '#dividendForm [name="recordDate"]',

        '#dividendForm [name="payDate"]'

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
   RENDER ALL
================================================== */

function renderAll() {

    renderDashboard();

    renderPortfolio();

    renderTransactions();

    renderDividends();

    renderSettings();

}


/* ==================================================
   START APP
================================================== */

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
