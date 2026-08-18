/*
====================================================
ĐẦU TƯ CỔ TỨC
APP.JS - BẢN HOÀN CHỈNH
====================================================

QUẢN LÝ DANH MỤC:
- Nạp tiền
- Mua / bán cổ phiếu
- Giá vốn bình quân
- FIFO
- Phí giao dịch mặc định 0,25%
- Có thể chỉnh phí
- Theo dõi từng lô
- Phí lưu ký 0,009đ/CP/ngày
- Cổ tức tiền mặt
- Cổ tức cổ phiếu
- Cổ phiếu thưởng
- Tự tính CP đủ điều kiện ngày chốt quyền
- Ví cổ tức
- Tái đầu tư cổ tức
- Lãi tiền mặt 4%/năm
- Lịch sử giao dịch
- Lịch sử cổ tức
- Backup / Restore JSON

DỰ PHÓNG:
- Không ảnh hưởng danh mục thật
- Không lưu dữ liệu
- Cổ tức tăng trưởng
- Giá cổ phiếu tăng trưởng
- Tiền nạp hàng tháng tùy chọn
- Tỷ lệ tái đầu tư tùy chọn
- Mua theo lô 100 CP
- Tiền dư chuyển sang năm sau
- Có tính phí giao dịch
====================================================
*/


/* ==================================================
   STORAGE
================================================== */

const STORAGE_KEY = "dautucotuc_v2";


const DEFAULT_DATA = {

    cash: 0,

    dividendWallet: 0,

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


function uid(prefix = "id") {

    return (
        prefix +
        "_" +
        Date.now() +
        "_" +
        Math.random()
            .toString(36)
            .slice(2, 9)
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
        .replace(
            /[&<>"']/g,
            char => {

                const map = {

                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;"

                };

                return map[char];

            }
        );

}


function daysBetween(start, end) {

    if (!start || !end) {

        return 0;

    }


    const a =
        new Date(
            start + "T00:00:00"
        );

    const b =
        new Date(
            end + "T00:00:00"
        );


    if (
        Number.isNaN(a.getTime()) ||
        Number.isNaN(b.getTime())
    ) {

        return 0;

    }


    return Math.max(
        0,
        Math.floor(
            (
                b.getTime() -
                a.getTime()
            ) /
            86400000
        ) + 1
    );

}


function mergeData(base, source) {

    if (
        !source ||
        typeof source !== "object"
    ) {

        return base;

    }


    for (
        const key of Object.keys(source)
    ) {

        const value =
            source[key];


        if (
            value &&
            typeof value === "object" &&
            !Array.isArray(value)
        ) {

            base[key] =
                mergeData(
                    base[key] || {},
                    value
                );

        } else {

            base[key] =
                value;

        }

    }


    return base;

}


function safeNumber(value) {

    const n =
        Number(value);

    return Number.isFinite(n)
        ? n
        : 0;

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


        const parsed =
            JSON.parse(saved);


        return mergeData(
            clone(DEFAULT_DATA),
            parsed
        );

    } catch (error) {

        console.error(
            "Load data error:",
            error
        );


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


    if (!element) {

        return;

    }


    element.textContent =
        message;


    element.classList.add(
        "show"
    );


    clearTimeout(
        window.__toastTimer
    );


    window.__toastTimer =
        setTimeout(
            () => {

                element.classList.remove(
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

    const percent =
        safeNumber(
            data.settings.fee
        );


    return (
        safeNumber(amount) *
        percent /
        100
    );

}


/* ==================================================
   DEPOSIT
================================================== */

function addDeposit(form) {

    const amount =
        safeNumber(
            form.amount.value
        );


    const date =
        form.date.value;


    if (
        amount <= 0
    ) {

        throw new Error(
            "Số tiền nạp phải lớn hơn 0."
        );

    }


    if (!date) {

        throw new Error(
            "Vui lòng chọn ngày nạp tiền."
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
                        .toUpperCase()
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
                        .toUpperCase()
                );

            }

        }
    );


    return Array.from(
        symbols
    ).sort();

}


/* ==================================================
   EVENT SORTING
================================================== */

function eventPriority(
    eventType
) {

    const priority = {

        stockDividend: 0,

        buy: 1,

        sell: 2

    };


    return (
        priority[eventType] ?? 1
    );

}


/* ==================================================
   FIFO REPLAY
================================================== */

function replaySymbol(symbol) {

    symbol =
        String(symbol || "")
            .trim()
            .toUpperCase();


    const events = [];


    /*
       Giao dịch mua / bán
    */

    data.transactions
        .filter(
            t =>
                String(t.symbol || "")
                    .toUpperCase() ===
                symbol
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
       Cổ tức bằng cổ phiếu
       / cổ phiếu thưởng
    */

    data.dividends
        .filter(
            d =>
                String(d.symbol || "")
                    .toUpperCase() ===
                symbol &&
                d.type !== "cash" &&
                safeNumber(
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
                        safeNumber(
                            d.receivedQty
                        ),

                    price: 0

                });

            }
        );


    events.sort(
        (a, b) => {

            const dateA =
                String(a.date || "");

            const dateB =
                String(b.date || "");


            const dateCompare =
                dateA.localeCompare(
                    dateB
                );


            if (
                dateCompare !== 0
            ) {

                return dateCompare;

            }


            return (
                eventPriority(
                    a.eventType
                ) -
                eventPriority(
                    b.eventType
                )
            );

        }
    );


    const lots = [];


    for (
        const event of events
    ) {

        /*
           MUA
        */

        if (
            event.eventType === "buy"
        ) {

            lots.push({

                id:
                    event.id,

                date:
                    event.date,

                qty:
                    safeNumber(
                        event.qty
                    ),

                price:
                    safeNumber(
                        event.price
                    ),

                source:
                    "buy"

            });

        }


        /*
           CỔ TỨC CP / THƯỞNG
        */

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
                    safeNumber(
                        event.qty
                    ),

                price: 0,

                source:
                    "dividend"

            });

        }


        /*
           BÁN FIFO
        */

        else if (
            event.eventType === "sell"
        ) {

            let remaining =
                safeNumber(
                    event.qty
                );


            for (
                const lot of lots
            ) {

                if (
                    remaining <= 0.000001
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
                remaining > 0.000001
            ) {

                throw new Error(
                    `Không đủ ${symbol} để bán ${number(event.qty, 0)} CP.`
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

function getHoldingLots(
    symbol
) {

    return replaySymbol(
        symbol
    );

}


function getHoldingQuantity(
    symbol
) {

    return getHoldingLots(
        symbol
    ).reduce(
        (sum, lot) =>
            sum +
            safeNumber(
                lot.qty
            ),
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

    symbol =
        String(symbol || "")
            .trim()
            .toUpperCase();


    const events = [];


    /*
       Mua / bán
    */

    data.transactions
        .filter(
            t =>
                String(t.symbol || "")
                    .toUpperCase() ===
                symbol &&
                String(t.date || "") <=
                date
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
       Cổ phiếu từ quyền
    */

    data.dividends
        .filter(
            d =>
                String(d.symbol || "")
                    .toUpperCase() ===
                symbol &&
                d.type !== "cash" &&
                String(d.payDate || "") <=
                date
        )
        .forEach(
            d => {

                events.push({

                    date:
                        d.payDate,

                    eventType:
                        "stockDividend",

                    qty:
                        safeNumber(
                            d.receivedQty
                        )

                });

            }
        );


    events.sort(
        (a, b) => {

            const dateCompare =
                String(a.date || "")
                    .localeCompare(
                        String(b.date || "")
                    );


            if (
                dateCompare !== 0
            ) {

                return dateCompare;

            }


            return (
                eventPriority(
                    a.eventType
                ) -
                eventPriority(
                    b.eventType
                )
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

                qty:
                    safeNumber(
                        event.qty
                    )

            });

        }


        else if (
            event.eventType ===
            "stockDividend"
        ) {

            lots.push({

                qty:
                    safeNumber(
                        event.qty
                    )

            });

        }


        else if (
            event.eventType === "sell"
        ) {

            let remaining =
                safeNumber(
                    event.qty
                );


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
            sum +
            safeNumber(
                lot.qty
            ),
        0
    );

}


/* ==================================================
   CASH BALANCE
================================================== */

function calculateCash() {

    let cash = 0;


    /*
       NẠP TIỀN
    */

    data.deposits.forEach(
        deposit => {

            cash +=
                safeNumber(
                    deposit.amount
                );

        }
    );


    /*
       MUA BẰNG TIỀN MẶT
    */

    data.transactions.forEach(
        transaction => {

            if (
                transaction.type ===
                "buy" &&
                transaction.source ===
                "cash"
            ) {

                cash -=
                    safeNumber(
                        transaction.total
                    );

            }


            /*
               BÁN
            */

            if (
                transaction.type ===
                "sell"
            ) {

                cash +=
                    safeNumber(
                        transaction.net
                    );

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


    /*
       CỔ TỨC TIỀN MẶT
    */

    data.dividends
        .filter(
            d =>
                d.type === "cash"
        )
        .forEach(
            d => {

                wallet +=
                    safeNumber(
                        d.cashTotal
                    );

            }
        );


    /*
       MUA BẰNG VÍ CỔ TỨC
    */

    data.transactions
        .filter(
            t =>
                t.type === "buy" &&
                t.source ===
                "dividend"
        )
        .forEach(
            t => {

                wallet -=
                    safeNumber(
                        t.total
                    );

            }
        );


    return wallet;

}


/* ==================================================
   CASH INTEREST
================================================== */

function calculateCashInterest() {

    const events = [];


    /*
       Tiền nạp
    */

    data.deposits.forEach(
        deposit => {

            events.push({

                date:
                    deposit.date,

                delta:
                    safeNumber(
                        deposit.amount
                    )

            });

        }
    );


    /*
       Mua bằng tiền mặt
    */

    data.transactions.forEach(
        transaction => {

            if (
                transaction.type ===
                "buy" &&
                transaction.source ===
                "cash"
            ) {

                events.push({

                    date:
                        transaction.date,

                    delta:
                        -safeNumber(
                            transaction.total
                        )

                });

            }


            /*
               Bán
            */

            if (
                transaction.type ===
                "sell"
            ) {

                events.push({

                    date:
                        transaction.date,

                    delta:
                        safeNumber(
                            transaction.net
                        )

                });

            }

        }
    );


    events.sort(
        (a, b) =>
            String(a.date)
                .localeCompare(
                    String(b.date)
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
                ) - 1;


            if (
                days > 0
            ) {

                interest +=
                    balance *
                    safeNumber(
                        data.settings
                            .interest
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


    /*
       Từ ngày cuối cùng
       đến hôm nay.
    */

    const finalDays =
        daysBetween(
            currentDate,
            today()
        );


    if (
        finalDays > 0
    ) {

        interest +=
            balance *
            safeNumber(
                data.settings
                    .interest
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
        !data.settings
            .custodyEnabled
    ) {

        return 0;

    }


    const endDate =
        today();


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

                const days =
                    daysBetween(
                        lot.date,
                        endDate
                    );


                total +=
                    safeNumber(
                        lot.qty
                    ) *
                    safeNumber(
                        data.settings
                            .custody
                    ) *
                    days;

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
                    sum +
                    safeNumber(
                        lot.qty
                    ),
                0
            );


        const cost =
            lots.reduce(
                (sum, lot) =>
                    sum +
                    safeNumber(
                        lot.qty
                    ) *
                    safeNumber(
                        lot.price
                    ),
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
                        String(
                            t.symbol || ""
                        ).toUpperCase() ===
                        symbol
                )
                .reduce(
                    (sum, t) =>
                        sum +
                        safeNumber(
                            t.fee
                        ),
                    0
                );


        const cashDividend =
            data.dividends
                .filter(
                    d =>
                        String(
                            d.symbol || ""
                        ).toUpperCase() ===
                        symbol &&
                        d.type === "cash"
                )
                .reduce(
                    (sum, d) =>
                        sum +
                        safeNumber(
                            d.cashTotal
                        ),
                    0
                );


        const stockDividend =
            data.dividends
                .filter(
                    d =>
                        String(
                            d.symbol || ""
                        ).toUpperCase() ===
                        symbol &&
                        d.type !== "cash"
                )
                .reduce(
                    (sum, d) =>
                        sum +
                        safeNumber(
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
        safeNumber(
            form.qty.value
        );


    const price =
        safeNumber(
            form.price.value
        );


    const source =
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


    /*
       MUA
    */

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


    /*
       BÁN
    */

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


        /*
           Giá vốn FIFO
        */

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
                remaining <=
                0.000001
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
                safeNumber(
                    lot.price
                );


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


    /*
       KIỂM TRA FIFO
    */

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


    if (
        payDate <
        recordDate
    ) {

        throw new Error(
            "Ngày nhận cổ tức không thể trước ngày chốt quyền."
        );

    }


    /*
       CP đủ điều kiện
    */

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


    /*
       CỔ TỨC TIỀN
    */

    if (
        type === "cash"
    ) {

        const cashPerShare =
            safeNumber(
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


    /*
       CỔ TỨC CP
       / CP THƯỞNG
    */

    else {

        const base =
            safeNumber(
                form.ratioBase.value
            );


        const newShares =
            safeNumber(
                form.ratioNew.value
            );


        if (
            base <= 0 ||
            newShares <= 0
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


        if (
            dividend.receivedQty <= 0
        ) {

            throw new Error(
                "Số cổ phiếu nhận được bằng 0."
            );

        }

    }


    data.dividends.push(
        dividend
    );


    /*
       Kiểm tra dữ liệu
    */

    try {

        getHoldingLots(
            symbol
        );

    } catch (error) {

        data.dividends.pop();

        throw error;

    }


    saveData();


    form.reset();


    if (
        form.recordDate
    ) {

        form.recordDate.value =
            today();

    }


    if (
        form.payDate
    ) {

        form.payDate.value =
            today();

    }


    if (
        form.ratioBase
    ) {

        form.ratioBase.value =
            10;

    }


    if (
        form.ratioNew
    ) {

        form.ratioNew.value =
            1;

    }


    if (
        form.cashPerShare
    ) {

        form.cashPerShare.value =
            0;

    }


    toast(
        "Đã lưu quyền cổ tức."
    );

}


/* ==================================================
   DELETE TRANSACTION
================================================== */

function deleteTransaction(
    id
) {

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


        saveData();


        alert(
            error.message
        );

    }

}


/* ==================================================
   DELETE DIVIDEND
================================================== */

function deleteDividend(
    id
) {

    if (
        !confirm(
            "Xóa quyền cổ tức này?"
        )
    ) {

        return;

    }


    const backup =
        clone(data);


    data.dividends =
        data.dividends.filter(
            d =>
                d.id !== id
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
            "Đã xóa cổ tức."
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


/* ==================================================
   DASHBOARD
================================================== */

function renderDashboard() {

    const portfolio =
        getPortfolio();


    const deposits =
        data.deposits.reduce(
            (sum, deposit) =>
                sum +
                safeNumber(
                    deposit.amount
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
                sum +
                safeNumber(
                    item.cost
                ),
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
                    safeNumber(
                        d.cashTotal
                    ),
                0
            );


    const fees =
        data.transactions.reduce(
            (sum, transaction) =>
                sum +
                safeNumber(
                    transaction.fee
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


    if (!dashboard) {

        return;

    }


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


    if (!element) {

        return;

    }


    if (
        portfolio.length === 0
    ) {

        element.innerHTML = `

            <div class="card">

                <div class="hint">

                    Chưa có cổ phiếu.

                    Hãy thêm giao dịch mua
                    đầu tiên.

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
                                    item.quantity,
                                    0
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
        !transactions ||
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
                    String(
                        b.date || ""
                    ).localeCompare(
                        String(
                            a.date || ""
                        )
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
                                transaction.type ===
                                "sell"
                                    ? "red"
                                    : "green"
                            }">

                                ${
                                    transaction.type ===
                                    "buy"
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
                                    transaction.type ===
                                    "buy"

                                        ? (
                                            transaction.source ===
                                            "dividend"
                                                ? "Ví cổ tức"
                                                : "Tiền mặt"
                                          )

                                        : "—"
                                }

                            </td>


                            <td>

                                <button
                                    class="action"
                                    onclick="deleteTransaction('${escapeHTML(transaction.id)}')">

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
   RENDER TRANSACTIONS
================================================== */

function renderTransactions() {

    const element =
        document.getElementById(
            "transactions"
        );


    if (element) {

        element.innerHTML =
            transactionTable(
                data.transactions
            );

    }


    const recent =
        document.getElementById(
            "recent"
        );


    if (recent) {

        recent.innerHTML =
            transactionTable(
                data.transactions
                    .slice()
                    .sort(
                        (a, b) =>
                            String(
                                b.date || ""
                            ).localeCompare(
                                String(
                                    a.date || ""
                                )
                            )
                    )
                    .slice(
                        0,
                        8
                    )
            );

    }

}


/* ==================================================
   RENDER DIVIDENDS
================================================== */

function renderDividends() {

    const element =
        document.getElementById(
            "dividends"
        );


    if (!element) {

        return;

    }


    const dividends =
        data.dividends
            .slice()
            .sort(
                (a, b) =>
                    String(
                        b.payDate || ""
                    ).localeCompare(
                        String(
                            a.payDate || ""
                        )
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

                    <th>
                        Ngày chốt
                    </th>

                    <th>
                        Ngày nhận
                    </th>

                    <th>
                        Mã
                    </th>

                    <th>
                        Loại
                    </th>

                    <th>
                        CP đủ ĐK
                    </th>

                    <th>
                        Kết quả
                    </th>

                    <th></th>

                </tr>

            </thead>


            <tbody>

                ${dividends.map(
                    dividend => {

                        let result;


                        if (
                            dividend.type ===
                            "cash"
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
                                )} CP (${number(
                                    dividend.ratioBase,
                                    0
                                )}:${number(
                                    dividend.ratioNew,
                                    0
                                )})`;

                        }


                        let typeText =
                            "Cổ tức CP";


                        if (
                            dividend.type ===
                            "cash"
                        ) {

                            typeText =
                                "Tiền mặt";

                        } else if (
                            dividend.type ===
                            "bonus"
                        ) {

                            typeText =
                                "CP thưởng";

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
                                    ${typeText}
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
                                        onclick="deleteDividend('${escapeHTML(dividend.id)}')">

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


    if (
        form.fee
    ) {

        form.fee.value =
            data.settings.fee;

    }


    if (
        form.custody
    ) {

        form.custody.value =
            data.settings.custody;

    }


    if (
        form.interest
    ) {

        form.interest.value =
            data.settings.interest;

    }


    if (
        form.custodyEnabled
    ) {

        form.custodyEnabled.checked =
            !!data.settings
                .custodyEnabled;

    }

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
   RESET TRADE FORM
================================================== */

function resetTradeForm() {

    const form =
        document.getElementById(
            "tradeForm"
        );


    if (!form) {

        return;

    }


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


    if (
        form &&
        form.type
    ) {

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

        data:
            clone(data)

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
        () => {

            URL.revokeObjectURL(
                url
            );

        },
        1000
    );


    toast(
        "Đã xuất backup JSON."
    );

}


/* ==================================================
   RESTORE
================================================== */

async function restoreJSON(
    file
) {

    try {

        if (!file) {

            return;

        }


        const text =
            await file.text();


        const backup =
            JSON.parse(
                text
            );


        let restored;


        if (
            backup &&
            backup.data
        ) {

            restored =
                backup.data;

        } else {

            restored =
                backup;

        }


        if (
            !restored ||
            !Array.isArray(
                restored.transactions
            ) ||
            !Array.isArray(
                restored.dividends
            ) ||
            !Array.isArray(
                restored.deposits
            )
        ) {

            throw new Error(
                "File backup không hợp lệ."
            );

        }


        const newData =
            mergeData(
                clone(
                    DEFAULT_DATA
                ),
                restored
            );


        const oldData =
            data;


        data =
            newData;


        try {

            /*
               Kiểm tra toàn bộ FIFO.
            */

            for (
                const symbol of getSymbols()
            ) {

                getHoldingLots(
                    symbol
                );

            }

        } catch (error) {

            data =
                oldData;

            throw error;

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
   TAB SYSTEM
================================================== */

function setupTabs() {

    document
        .querySelectorAll(
            ".tab"
        )
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


                        const target =
                            document.getElementById(
                                button.dataset.tab
                            );


                        if (target) {

                            target.classList.add(
                                "active"
                            );

                        }

                    }
                );

            }
        );

}


/* ==================================================
   FORM EVENTS
================================================== */

function setupForms() {

    /*
       DEPOSIT
    */

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


    /*
       TRADE
    */

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


    /*
       DIVIDEND
    */

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


    /*
       SETTINGS
    */

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
                    Math.max(
                        0,
                        safeNumber(
                            form.fee.value
                        )
                    );


                data.settings.custody =
                    Math.max(
                        0,
                        safeNumber(
                            form.custody.value
                        )
                    );


                data.settings.interest =
                    Math.max(
                        0,
                        safeNumber(
                            form.interest.value
                        )
                    );


                data.settings
                    .custodyEnabled =
                    !!(
                        form
                            .custodyEnabled
                            ?.checked
                    );


                saveData();


                toast(
                    "Đã lưu cài đặt."
                );

            }
        );

    }

}


/* ==================================================
   RESTORE INPUT
================================================== */

function setupRestore() {

    const input =
        document.getElementById(
            "restoreInput"
        );


    if (!input) {

        return;

    }


    input.addEventListener(
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

}


/* ==================================================
   DEFAULT DATES
================================================== */

function setupDefaultDates() {

    const selectors = [

        '#depositForm [name="date"]',

        '#tradeForm [name="date"]',

        '#dividendForm [name="recordDate"]',

        '#dividendForm [name="payDate"]'

    ];


    document
        .querySelectorAll(
            selectors.join(",")
        )
        .forEach(
            input => {

                if (
                    !input.value
                ) {

                    input.value =
                        today();

                }

            }
        );

}


/* ==================================================
   DIVIDEND PROJECTION
==================================================

   DỰ PHÓNG ĐỘC LẬP

   Không lưu vào localStorage.

   Không tạo giao dịch thật.

================================================== */

function projectionMoney(
    value
) {

    return new Intl.NumberFormat(
        "vi-VN",
        {
            maximumFractionDigits: 0
        }
    ).format(
        Math.round(
            safeNumber(value)
        )
    ) + " đ";

}


function projectionNumber(
    value
) {

    return new Intl.NumberFormat(
        "vi-VN",
        {
            maximumFractionDigits: 0
        }
    ).format(
        Math.round(
            safeNumber(value)
        )
    );

}


/* ==================================================
   PROJECTION INPUT
================================================== */

function getProjectionInput(
    id
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {

        return "";

    }


    return element.value;

}


/* ==================================================
   RUN PROJECTION
================================================== */

function runDividendProjection() {

    /*
       MÃ NGUỒN
    */

    const source =
        String(
            getProjectionInput(
                "projectionSource"
            )
        ).trim()
            .toUpperCase();


    /*
       MÃ NHẬN
    */

    const target =
        String(
            getProjectionInput(
                "projectionTarget"
            )
        ).trim()
            .toUpperCase();


    /*
       CP BAN ĐẦU
    */

    let shares =
        safeNumber(
            getProjectionInput(
                "projectionShares"
            )
        );


    /*
       GIÁ BAN ĐẦU
    */

    const initialPrice =
        safeNumber(
            getProjectionInput(
                "projectionPrice"
            )
        );


    /*
       CỔ TỨC / CP
    */

    const initialDividend =
        safeNumber(
            getProjectionInput(
                "projectionDividend"
            )
        );


    /*
       TĂNG TRƯỞNG CỔ TỨC
    */

    const dividendGrowth =
        safeNumber(
            getProjectionInput(
                "projectionDividendGrowth"
            )
        );


    /*
       TĂNG GIÁ CP
    */

    const priceGrowth =
        safeNumber(
            getProjectionInput(
                "projectionPriceGrowth"
            )
        );


    /*
       TIỀN NẠP MỖI THÁNG
    */

    const monthlyMoney =
        Math.max(
            0,
            safeNumber(
                getProjectionInput(
                    "projectionMonthlyMoney"
                )
            )
        );


    /*
       % TÁI ĐẦU TƯ
    */

    let reinvestPercent =
        safeNumber(
            getProjectionInput(
                "projectionReinvest"
            )
        );


    /*
       SỐ NĂM
    */

    const years =
        Math.max(
            1,
            Math.floor(
                safeNumber(
                    getProjectionInput(
                        "projectionYears"
                    )
                )
            )
        );


    /*
       PHÍ MUA

       Dùng phí giao dịch
       hiện tại của app.

       Ví dụ:
       0,25%
    */

    const feePercent =
        Math.max(
            0,
            safeNumber(
                data.settings.fee
            )
        );


    /*
       KIỂM TRA
    */

    if (
        initialPrice <= 0
    ) {

        alert(
            "Giá cổ phiếu phải lớn hơn 0."
        );

        return;

    }


    if (
        initialDividend < 0
    ) {

        alert(
            "Cổ tức không được âm."
        );

        return;

    }


    if (
        shares < 0
    ) {

        shares = 0;

    }


    reinvestPercent =
        Math.max(
            0,
            Math.min(
                100,
                reinvestPercent
            )
        );


    /*
       BIẾN TÍCH LŨY
    */

    let carryCash = 0;

    let totalDividend = 0;

    let totalReinvest = 0;

    let totalNewShares = 0;

    let totalContribution = 0;

    let totalFees = 0;

    const rows = [];


    /*
       TỪNG NĂM
    */

    for (
        let year = 1;
        year <= years;
        year++
    ) {

        /*
           CP ĐẦU NĂM
        */

        const startShares =
            shares;


        /*
           CỔ TỨC / CP
        */

        const dividendPerShare =
            initialDividend *
            Math.pow(
                1 +
                dividendGrowth /
                100,
                year - 1
            );


        /*
           TIỀN CỔ TỨC
        */

        const dividendMoney =
            startShares *
            dividendPerShare;


        /*
           TIỀN NẠP

           Nếu người dùng nhập 0
           thì mô hình chỉ dùng
           cổ tức + tiền dư.

        */

        const contribution =
            monthlyMoney *
            12;


        totalContribution +=
            contribution;


        /*
           TIỀN CÓ THỂ SỬ DỤNG
        */

        const availableMoney =
            carryCash +
            dividendMoney +
            contribution;


        /*
           PHẦN ĐƯỢC PHÉP TÁI ĐẦU TƯ
        */

        const moneyForReinvest =
            availableMoney *
            reinvestPercent /
            100;


        /*
           TIỀN GIỮ LẠI
        */

        const moneyNotReinvest =
            availableMoney -
            moneyForReinvest;


        /*
           GIÁ CỔ PHIẾU

           Giá mô hình tại năm đó.
        */

        const currentPrice =
            initialPrice *
            Math.pow(
                1 +
                priceGrowth /
                100,
                year - 1
            );


        /*
           TÍNH SỐ CP CÓ THỂ MUA

           Có tính phí.

           Chi phí thực tế của
           100 CP:

           100 × giá ×
           (1 + phí%)
        */

        const costPerShare =
            currentPrice *
            (
                1 +
                feePercent /
                100
            );


        const possibleShares =
            costPerShare > 0

                ? Math.floor(
                    moneyForReinvest /
                    costPerShare
                  )

                : 0;


        /*
           CHỈ MUA LÔ 100 CP
        */

        const buyShares =
            Math.floor(
                possibleShares /
                100
            ) *
            100;


        /*
           TIỀN MUA CP
        */

        const stockValue =
            buyShares *
            currentPrice;


        /*
           PHÍ MUA
        */

        const purchaseFee =
            stockValue *
            feePercent /
            100;


        /*
           TỔNG TIỀN THỰC CHI
        */

        const purchaseMoney =
            stockValue +
            purchaseFee;


        /*
           TIỀN DƯ

           Bao gồm:

           - Tiền không tái đầu tư
           - Tiền tái đầu tư nhưng
             không đủ lô 100 CP

        */

        carryCash =
            moneyNotReinvest +
            (
                moneyForReinvest -
                purchaseMoney
            );


        /*
           CẬP NHẬT CP
        */

        shares +=
            buyShares;


        /*
           TÍCH LŨY
        */

        totalDividend +=
            dividendMoney;


        totalReinvest +=
            purchaseMoney;


        totalNewShares +=
            buyShares;


        totalFees +=
            purchaseFee;


        /*
           GIÁ TRỊ CP CUỐI NĂM
        */

        const endValue =
            shares *
            currentPrice;


        /*
           TỔNG TÀI SẢN MÔ PHỎNG

           = Giá trị CP
           + tiền dư
        */

        const totalValue =
            endValue +
            carryCash;


        rows.push({

            year,

            startShares,

            dividendPerShare,

            dividendMoney,

            contribution,

            availableMoney,

            moneyForReinvest,

            currentPrice,

            purchaseMoney,

            purchaseFee,

            buyShares,

            cashRemainder:
                carryCash,

            endShares:
                shares,

            endValue,

            totalValue

        });

    }


    /*
       Nếu không có năm nào
       thì dừng.
    */

    if (
        rows.length === 0
    ) {

        return;

    }


    /*
       SUMMARY
    */

    const summary =
        document.getElementById(
            "projectionSummary"
        );


    if (summary) {

        summary.innerHTML = `

            <div class="projection-stat">

                <span>
                    Mã nguồn
                </span>

                <strong>
                    ${escapeHTML(
                        source || "-"
                    )}
                </strong>

            </div>


            <div class="projection-stat">

                <span>
                    Mã nhận
                </span>

                <strong>
                    ${escapeHTML(
                        target || "-"
                    )}
                </strong>

            </div>


            <div class="projection-stat">

                <span>
                    CP cuối kỳ
                </span>

                <strong>
                    ${projectionNumber(
                        shares
                    )}
                </strong>

            </div>


            <div class="projection-stat">

                <span>
                    Cổ tức tích lũy
                </span>

                <strong>
                    ${projectionMoney(
                        totalDividend
                    )}
                </strong>

            </div>


            <div class="projection-stat">

                <span>
                    Tổng tái đầu tư
                </span>

                <strong>
                    ${projectionMoney(
                        totalReinvest
                    )}
                </strong>

            </div>


            <div class="projection-stat">

                <span>
                    CP mua thêm
                </span>

                <strong>
                    ${projectionNumber(
                        totalNewShares
                    )}
                </strong>

            </div>


            <div class="projection-stat">

                <span>
                    Tiền nạp thêm
                </span>

                <strong>
                    ${projectionMoney(
                        totalContribution
                    )}
                </strong>

            </div>


            <div class="projection-stat">

                <span>
                    Phí mua
                </span>

                <strong>
                    ${projectionMoney(
                        totalFees
                    )}
                </strong>

            </div>


            <div class="projection-stat">

                <span>
                    Tiền dư cuối kỳ
                </span>

                <strong>
                    ${projectionMoney(
                        carryCash
                    )}
                </strong>

            </div>


            <div class="projection-stat">

                <span>
                    Giá trị cuối kỳ
                </span>

                <strong>
                    ${projectionMoney(
                        rows[
                            rows.length - 1
                        ].endValue
                    )}
                </strong>

            </div>


            <div class="projection-stat">

                <span>
                    Tổng tài sản mô phỏng
                </span>

                <strong>
                    ${projectionMoney(
                        rows[
                            rows.length - 1
                        ].totalValue
                    )}
                </strong>

            </div>

        `;

    }


    /*
       BẢNG
    */

    const table =
        document.getElementById(
            "projectionTable"
        );


    if (!table) {

        return;

    }


    table.innerHTML = `

        <table>

            <thead>

                <tr>

                    <th>Năm</th>

                    <th>CP đầu năm</th>

                    <th>Cổ tức/CP</th>

                    <th>Cổ tức nhận</th>

                    <th>Tiền nạp</th>

                    <th>Giá CP</th>

                    <th>Tiền mua</th>

                    <th>Phí</th>

                    <th>CP mua</th>

                    <th>CP cuối năm</th>

                    <th>Tiền dư</th>

                    <th>Giá trị CP</th>

                    <th>Tổng tài sản</th>

                </tr>

            </thead>


            <tbody>

                ${rows.map(
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
                                    row.currentPrice
                                )}
                            </td>


                            <td>
                                ${projectionMoney(
                                    row.purchaseMoney
                                )}
                            </td>


                            <td>
                                ${projectionMoney(
                                    row.purchaseFee
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
                                    row.cashRemainder
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

            <b>Quy tắc dự phóng:</b>

            <br><br>

            ${escapeHTML(
                source || "Mã nguồn"
            )}

            →
            
            ${escapeHTML(
                target || "Mã nhận"
            )}

            <br><br>

            Cổ tức nhận được +
            tiền nạp +
            tiền dư năm trước
            được gom lại.

            <br><br>

            Tỷ lệ tái đầu tư:

            <b>
                ${number(
                    reinvestPercent,
                    0
                )}%
            </b>

            <br><br>

            Chỉ mua theo
            <b>lô 100 CP</b>.

            <br><br>

            Tiền chưa đủ mua
            lô 100 CP sẽ
            <b>được giữ lại</b>
            và chuyển sang
            năm tiếp theo.

            <br><br>

            Phí giao dịch mô phỏng:

            <b>
                ${number(
                    feePercent,
                    3
                )}%
            </b>

            <br><br>

            Đây chỉ là mô hình
            dự phóng, không tạo
            giao dịch thật và
            không lưu vào danh mục.

        </div>

    `;

}


/* ==================================================
   INITIALIZATION
================================================== */

function initializeApp() {

    setupTabs();

    setupForms();

    setupRestore();

    setupDefaultDates();

    renderAll();

}


/* ==================================================
   START
================================================== */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeApp
    );

} else {

    initializeApp();

}
