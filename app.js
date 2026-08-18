/*
====================================================
ĐẦU TƯ CỔ TỨC
APP.JS - BẢN HOÀN CHỈNH
====================================================

QUẢN LÝ:
- Nạp tiền
- Mua / bán cổ phiếu
- Giá vốn bình quân
- Phí giao dịch
- FIFO
- Theo dõi từng lô
- Phí lưu ký
- Cổ tức tiền mặt
- Cổ tức cổ phiếu
- Cổ phiếu thưởng
- Ví cổ tức
- Tái đầu tư cổ tức
- Tiền mặt
- Lãi tiền mặt tính theo ngày
- Chỉnh lãi suất tiền mặt
- Lịch sử giao dịch
- Lịch sử cổ tức
- Backup / Restore
- Dự phóng tái đầu tư

DỰ PHÓNG:
- Có / không có mã tái đầu tư
- Tiền cổ tức
- Tiền nạp thêm
- Tiền dư
- Tiền mặt sinh lãi theo ngày
- Chỉ mua lô 100 CP
- Tiền chưa đủ mua 100 CP được giữ lại
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
            .substring(2, 8)
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


function number(value, digits = 2) {

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
        .replace(/[&<>"']/g, char => {

            return {

                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"

            }[char];

        });

}


function daysBetween(start, end) {

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

            base[key] =
                source[key];

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

    const element =
        document.getElementById(
            "toast"
        );

    if (!element) return;

    element.textContent =
        message;

    element.classList.add(
        "show"
    );

    clearTimeout(
        window.__toastTimer
    );

    window.__toastTimer =
        setTimeout(() => {

            element.classList.remove(
                "show"
            );

        }, 2500);

}


/* ==================================================
   TRADING FEE
================================================== */

function calculateTradingFee(amount) {

    const percent =
        Number(
            data.settings.fee
        ) || 0;

    return (
        amount *
        percent /
        100
    );

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
            form.date.value,

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
   SYMBOL LIST
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
   FIFO REPLAY
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


    /*
       Cổ tức CP / CP thưởng
    */

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
                a.date.localeCompare(
                    b.date
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
                    uid("dividend_lot"),

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


/* ==================================================
   HOLDING
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
            a.date.localeCompare(
                b.date
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
                    Number(
                        event.qty
                    ) || 0

            });

        }

        else if (
            event.eventType ===
            "stockDividend"
        ) {

            lots.push({

                qty:
                    Number(
                        event.qty
                    ) || 0

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


    return wallet;

}


/* ==================================================
   CASH INTEREST
   4% / NĂM - TÍNH THEO NGÀY
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
                        -Number(
                            transaction.total
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


    events.sort(
        (a, b) =>
            a.date.localeCompare(
                b.date
            )
    );


    if (
        events.length === 0
    ) {

        return 0;

    }


    let balance = 0;

    let interest = 0;

    let currentDate =
        events[0].date;


    for (
        const event of events
    ) {

        if (
            event.date >
            currentDate
        ) {

            const days =
                daysBetween(
                    currentDate,
                    event.date
                );


            if (
                days > 0 &&
                balance > 0
            ) {

                interest +=
                    balance *
                    (
                        Number(
                            data.settings.interest
                        ) || 0
                    ) /
                    100 *
                    days /
                    365;

            }

        }


        balance +=
            event.delta;

        currentDate =
            event.date;

    }


    const finalDays =
        daysBetween(
            currentDate,
            today()
        ) + 1;


    if (
        finalDays > 0 &&
        balance > 0
    ) {

        interest +=
            balance *
            (
                Number(
                    data.settings.interest
                ) || 0
            ) /
            100 *
            finalDays /
            365;

    }


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
                ) + 1;


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

    const source =
        form.source.value;


    if (
        !date ||
        !symbol ||
        quantity <= 0 ||
        price <= 0
    ) {

        throw new Error(
            "Kiểm tra lại thông tin giao dịch."
        );

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
                total -
                0.000001
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
                total -
                0.000001
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
            quantity -
            0.000001
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

        let costBasis =
            0;


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
                net -
                costBasis,

            note:
                form.note.value.trim()

        });

    }


    try {

        getHoldingLots(
            symbol
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
            ) +
            0.000001
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

        const cashPerShare =
            Number(
                form.cashPerShare.value
            );


        if (
            cashPerShare <= 0
        ) {

            throw new Error(
                "Cổ tức / CP phải lớn hơn 0."
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

    toast(
        "Đã lưu quyền cổ tức."
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
    ) {

        return;

    }


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


    const dashboard =
        document.getElementById(
            "dashboard"
        );


    if (!dashboard) return;


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


    if (!element) return;


    if (
        portfolio.length === 0
    ) {

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
            item => `

                <div class="card stock-card">

                    <h3>
                        ${escapeHTML(
                            item.symbol
                        )}
                    </h3>

                    <div class="stock-meta">

                        <div class="kv">
                            <span>Số CP</span>
                            <b>
                                ${number(
                                    item.quantity,
                                    0
                                )}
                            </b>
                        </div>

                        <div class="kv">
                            <span>Giá vốn BQ</span>
                            <b>
                                ${money(
                                    item.averageCost
                                )}
                            </b>
                        </div>

                        <div class="kv">
                            <span>Giá vốn còn lại</span>
                            <b>
                                ${money(
                                    item.cost
                                )}
                            </b>
                        </div>

                        <div class="kv">
                            <span>Số lô</span>
                            <b>
                                ${item.lots.length}
                            </b>
                        </div>

                        <div class="kv">
                            <span>Cổ tức tiền</span>
                            <b>
                                ${money(
                                    item.cashDividend
                                )}
                            </b>
                        </div>

                        <div class="kv">
                            <span>CP từ quyền</span>
                            <b>
                                ${number(
                                    item.stockDividend,
                                    0
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
                    b.date.localeCompare(
                        a.date
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
                                    transaction.qty,
                                    0
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
                                    onclick="
                                        deleteTransaction(
                                            '${transaction.id}'
                                        )
                                    "
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


function renderTransactions() {

    const table =
        transactionTable(
            data.transactions
        );


    const transactions =
        document.getElementById(
            "transactions"
        );


    const recent =
        document.getElementById(
            "recent"
        );


    if (transactions) {

        transactions.innerHTML =
            table;

    }


    if (recent) {

        recent.innerHTML =
            transactionTable(
                data.transactions
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


    if (!element) return;


    const dividends =
        data.dividends
            .slice()
            .sort(
                (a, b) =>
                    b.payDate.localeCompare(
                        a.payDate
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

                        let result = "";


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
                                    dividend.receivedQty,
                                    0
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
                                        dividend.eligible,
                                        0
                                    )}
                                </td>

                                <td>
                                    ${result}
                                </td>

                                <td>

                                    <button
                                        class="action"
                                        onclick="
                                            deleteDividend(
                                                '${dividend.id}'
                                            )
                                        "
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


    if (!form) return;


    if (form.fee) {

        form.fee.value =
            data.settings.fee;

    }


    if (form.custody) {

        form.custody.value =
            data.settings.custody;

    }


    if (form.interest) {

        form.interest.value =
            data.settings.interest;

    }


    if (form.custodyEnabled) {

        form.custodyEnabled.checked =
            !!data.settings
                .custodyEnabled;

    }

}


/* ==================================================
   RESET TRADE FORM
================================================== */

function resetTradeForm() {

    const form =
        document.getElementById(
            "tradeForm"
        );


    if (!form) return;


    form.reset();

    if (form.date) {

        form.date.value =
            today();

    }

    if (form.type) {

        form.type.value =
            "buy";

    }

    if (form.source) {

        form.source.value =
            "cash";

    }

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


    if (form && form.type) {

        form.type.value =
            type;

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

    link.click();


    URL.revokeObjectURL(
        url
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
            JSON.parse(
                text
            );


        const restored =
            backup.data ||
            backup;


        if (
            !restored ||
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
                clone(
                    DEFAULT_DATA
                ),
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
   RESET ALL
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
   TAB
================================================== */

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
                                    .remove("active")
                        );


                    document
                        .querySelectorAll(".tab-panel")
                        .forEach(
                            panel =>
                                panel.classList
                                    .remove("active")
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


/* ==================================================
   FORMS
================================================== */

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

}


/* ==================================================
   SETTINGS FORM
================================================== */

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


            data.settings.custodyEnabled =
                form.custodyEnabled
                    ? form.custodyEnabled.checked
                    : true;


            saveData();


            toast(
                "Đã lưu cài đặt."
            );

        }
    );

}


/* ==================================================
   RESTORE INPUT
================================================== */

const restoreInput =
    document.getElementById(
        "restoreInput"
    );


if (restoreInput) {

    restoreInput.addEventListener(
        "change",
        async event => {

            const file =
                event.target.files[0];


            if (!file) return;


            await restoreJSON(
                file
            );


            event.target.value =
                "";

        }
    );

}


/* ==================================================
   DEFAULT DATES
================================================== */

document
    .querySelectorAll(
        '#depositForm [name="date"],' +
        '#tradeForm [name="date"],' +
        '#dividendForm [name="recordDate"],' +
        '#dividendForm [name="payDate"]'
    )
    .forEach(
        input => {

            input.value =
                today();

        }
    );


/* ==================================================
   DỰ PHÓNG TÁI ĐẦU TƯ
================================================== */


/*
====================================================
HÀM ĐỊNH DẠNG
====================================================
*/

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


/*
====================================================
TÍNH LÃI TIỀN MẶT THEO NGÀY
====================================================

Công thức:

Lãi ngày =
Tiền mặt × lãi suất năm / 100 / 365

Tiền lãi được cộng vào
tiền mặt cuối kỳ.

====================================================
*/

function projectionInterest(
    principal,
    annualRate,
    days
) {

    return (
        principal *
        (
            annualRate / 100
        ) *
        days /
        365
    );

}


/*
====================================================
DỰ PHÓNG
====================================================

Nếu có mã tái đầu tư:

Cổ tức
+
tiền nạp
+
tiền dư
+
lãi tiền mặt

→ mua mã nhận.

Nếu KHÔNG có mã tái đầu tư:

Không mua cổ phiếu.

Toàn bộ tiền được giữ dưới dạng
tiền mặt và tiếp tục sinh lãi.

====================================================
*/

function runDividendProjection() {

    const source =
        document
            .getElementById(
                "projectionSource"
            )
            ?.value
            .trim()
            .toUpperCase() || "";


    const target =
        document
            .getElementById(
                "projectionTarget"
            )
            ?.value
            .trim()
            .toUpperCase() || "";


    let shares =
        Number(
            document
                .getElementById(
                    "projectionShares"
                )
                ?.value
        ) || 0;


    let price =
        Number(
            document
                .getElementById(
                    "projectionPrice"
                )
                ?.value
        ) || 0;


    const firstDividend =
        Number(
            document
                .getElementById(
                    "projectionDividend"
                )
                ?.value
        ) || 0;


    const dividendGrowth =
        Number(
            document
                .getElementById(
                    "projectionDividendGrowth"
                )
                ?.value
        ) || 0;


    const priceGrowth =
        Number(
            document
                .getElementById(
                    "projectionPriceGrowth"
                )
                ?.value
        ) || 0;


    const monthlyMoney =
        Number(
            document
                .getElementById(
                    "projectionMonthlyMoney"
                )
                ?.value
        ) || 0;


    let reinvestPercent =
        Number(
            document
                .getElementById(
                    "projectionReinvest"
                )
                ?.value
        );


    const years =
        Number(
            document
                .getElementById(
                    "projectionYears"
                )
                ?.value
        ) || 1;


    /*
       LÃI TIỀN MẶT
    */

    let cashInterestRate =
        Number(
            document
                .getElementById(
                    "projectionCashInterest"
                )
                ?.value
        );


    if (
        !Number.isFinite(
            cashInterestRate
        )
    ) {

        cashInterestRate = 4;

    }


    /*
       TIỀN MẶT BAN ĐẦU
    */

    let cashRemainder =
        Number(
            document
                .getElementById(
                    "projectionInitialCash"
                )
                ?.value
        ) || 0;


    /*
       KIỂM TRA
    */

    if (
        price < 0
    ) {

        alert(
            "Giá cổ phiếu không hợp lệ."
        );

        return;

    }


    if (
        target &&
        price <= 0
    ) {

        alert(
            "Nếu có mã tái đầu tư thì giá cổ phiếu phải lớn hơn 0."
        );

        return;

    }


    if (
        firstDividend < 0
    ) {

        alert(
            "Cổ tức không được âm."
        );

        return;

    }


    if (
        reinvestPercent < 0
    ) {

        reinvestPercent = 0;

    }


    if (
        reinvestPercent > 100
    ) {

        reinvestPercent = 100;

    }


    /*
       BIẾN TỔNG
    */

    let totalDividend = 0;

    let totalReinvest = 0;

    let totalNewShares = 0;

    let totalContribution = 0;

    let totalInterest = 0;

    const rows = [];


    /*
       MỖI NĂM
    */

    for (
        let year = 1;
        year <= years;
        year++
    ) {

        const startShares =
            shares;


        /*
           CỔ TỨC / CP
        */

        const dividendPerShare =
            firstDividend *
            Math.pow(
                1 +
                dividendGrowth / 100,
                year - 1
            );


        /*
           CỔ TỨC NHẬN
        */

        const dividendMoney =
            startShares *
            dividendPerShare;


        /*
           TIỀN NẠP
        */

        const contribution =
            monthlyMoney *
            12;


        /*
           GIÁ CP
        */

        const currentPrice =
            target
                ? price *
                  Math.pow(
                      1 +
                      priceGrowth / 100,
                      year - 1
                  )
                : 0;


        /*
           TIỀN ĐẦU NĂM
        */

        const openingCash =
            cashRemainder;


        /*
           TIỀN CÓ TRƯỚC KHI MUA
        */

        const availableBeforeInterest =
            openingCash +
            dividendMoney +
            contribution;


        /*
           TÍNH LÃI TIỀN MẶT.

           Giả sử tiền được giữ trong
           suốt năm.

           365 ngày / năm.

           Lãi được nhập vào tiền mặt.
        */

        const interest =
            projectionInterest(
                available
