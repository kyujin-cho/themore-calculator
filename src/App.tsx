import './App.css'
import 'chart.js/auto'

import React from 'react'

import { Delete as DeleteIcon, Upload as UploadIcon } from '@mui/icons-material'
import { Button, Divider } from '@mui/material'
import { DataGrid, GridColDef, GridRowParams } from '@mui/x-data-grid'
import { DateTime } from 'luxon'
import { Bar, Pie } from 'react-chartjs-2'
import XLSX from 'xlsx'

const SPECIAL_STORES = [
    '(주)우아한형제들',
    '요기요_위대한상상',
    'KT통신요금 자동납부',
    'SKT 요금납부',
]
type RawRow = {
    이용일시: string
    승인번호: string
    본인구분: string
    브랜드: string
    이용카드: string
    가맹점명: string
    이용금액: number
    이용구분: string
    매입상태: '전표매입' | '승인취소' | ''
}
type Row = {
    id: string
    이용일시: DateTime
    승인번호: string
    본인구분: string
    브랜드: string
    이용카드: string
    가맹점명: string
    이용금액: number
    이용구분: string
    매입상태: '전표매입' | '승인취소' | ''
    firstTransactionOfTheDay: boolean
    point: number
    pickRate: number
}

const wonFormatter = new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
})
const percent = (val: number) => Math.round(val * 10000) / 100 + '%'
const padZero = (val: number, minLength = 2) => {
    let s = val.toString()
    while (s.length < minLength) s = '0' + s
    return s
}
const gridCols: GridColDef[] = [
    {
        field: '이용일시',
        headerName: '이용일시',
        minWidth: 150,
        valueFormatter: ({ value }) => {
            const d = value as DateTime
            return d.toFormat('yyyy-MM-dd HH:mm')
        },
    },
    {
        field: '승인번호',
        headerName: '승인번호',
        cellClassName: 'cell-fixedwidth',
    },
    {
        field: '이용카드',
        headerName: '카드번호 끝 3자리',
    },
    {
        field: '가맹점명',
        headerName: '가맹점명',
        minWidth: 220,
    },
    {
        field: '이용금액',
        headerName: '이용금액',
        valueFormatter: ({ value }) => wonFormatter.format(value as number),
    },
    {
        field: '이용구분',
        headerName: '이용구분',
    },
    {
        field: '매입상태',
        headerName: '매입상태',
    },
    {
        field: 'point',
        headerName: '적립 포인트',
        valueFormatter: ({ value }) => wonFormatter.format(value as number),
    },
    {
        field: 'pickRate',
        headerName: '피킹률',
        valueFormatter: ({ value }) => percent(value as number),
    },
]

const convertRow = ({ 이용일시, 가맹점명, ...row }: RawRow): Row => ({
    ...row,
    id: row.승인번호,
    이용일시: DateTime.fromFormat(이용일시, 'yyyy/MM/dd  HH:mm'),
    가맹점명,
    firstTransactionOfTheDay: false,
    point: 0,
    pickRate: 0,
})

const App = () => {
    const [transactions, setTransactions] = React.useState<Row[]>([])
    const [totalUsed, setTotalUsed] = React.useState(0)
    const [totalPoints, setTotalPoints] = React.useState(0)

    const processCardUsage = (sheetObj: XLSX.WorkSheet) => {
        const rawRows: RawRow[] = XLSX.utils.sheet_to_json<RawRow>(sheetObj)
        const rows: Row[] = rawRows.map(convertRow)
        const transactionByDate: { [date: string]: Row[] } = {}

        for (const transaction of rows) {
            const { 이용일시 } = transaction
            const date = 이용일시.toFormat('yyyy-MM-dd')
            if (transactionByDate[date] === undefined)
                transactionByDate[date] = []
            transactionByDate[date].push(transaction)
        }

        const calculatedTransactions: Row[] = []
        let totalUsed = 0
        let totalPoints = 0

        for (const date of Object.keys(transactionByDate)) {
            let metStores: { [key: string]: boolean } = {}

            for (const transaction of transactionByDate[date].sort(
                (a, b) => a.이용일시.toMillis() - b.이용일시.toMillis()
            )) {
                let firstTransactionOfTheDay = false
                if (
                    transaction.매입상태 !== '승인취소' &&
                    transaction.이용금액 >= 5000 &&
                    metStores[transaction.가맹점명] === undefined
                ) {
                    firstTransactionOfTheDay = true
                    metStores[transaction.가맹점명] = true
                }
                const point =
                    (transaction.이용금액 % 1000) *
                    (firstTransactionOfTheDay ? 1 : 0) *
                    (SPECIAL_STORES.indexOf(transaction.가맹점명) !== -1
                        ? 2
                        : 1)
                if (transaction.매입상태 !== '승인취소')
                    totalUsed += transaction.이용금액
                totalPoints += point

                calculatedTransactions.push({
                    ...transaction,
                    firstTransactionOfTheDay,
                    point,
                    pickRate: point / transaction.이용금액,
                })
            }
        }

        setTotalUsed(totalUsed)
        setTotalPoints(totalPoints)
        setTransactions(calculatedTransactions)
    }

    const onFileSelect = async (fileElem: HTMLInputElement) => {
        if (fileElem.files) {
            const file = fileElem.files[0]
            const data = await file.arrayBuffer()
            const workbook = XLSX.read(data)
            const sheet = workbook.Sheets[workbook.SheetNames[0]]
            processCardUsage(sheet)
        }
        document.removeChild(fileElem)
    }

    const onUploadClick = () => {
        const fileElem = document.createElement('input')
        fileElem.setAttribute('type', 'file')
        fileElem.setAttribute('style', 'display: none;')
        fileElem.setAttribute('accept', '.xls,.xlsx')
        fileElem.addEventListener('change', () => onFileSelect(fileElem))
        document.body.appendChild(fileElem)
        fileElem.click()
    }

    const onDeleteClick = () => {
        setTransactions([])
    }

    const transactionsByStore = React.useMemo(() => {
        const stores: {
            [key: string]: { totalUsed: number; totalPoints: number }
        } = {}
        for (const transaction of transactions) {
            if (transaction.매입상태 === '승인취소') continue
            if (stores[transaction.가맹점명] === undefined) {
                stores[transaction.가맹점명] = { totalUsed: 0, totalPoints: 0 }
            }
            stores[transaction.가맹점명] = {
                totalUsed:
                    stores[transaction.가맹점명].totalUsed +
                    transaction.이용금액,
                totalPoints:
                    stores[transaction.가맹점명].totalPoints +
                    transaction.point,
            }
        }
        return Object.keys(stores)
            .map((key) => ({ store: key, ...stores[key] }))
            .sort((a, b) => b.totalPoints - a.totalPoints)
    }, [transactions])

    return (
        <div style={{ padding: 12 }}>
            <h2 style={{ paddingTop: 12 }}>더모아 카드 피킹률 계산기</h2>
            {transactions.length === 0 ? (
                <div className="center" style={{ marginTop: 6, height: 800 }}>
                    <Button
                        variant="contained"
                        startIcon={<UploadIcon />}
                        onClick={onUploadClick}
                    >
                        .xls 파일 업로드
                    </Button>
                </div>
            ) : (
                <>
                    <Button
                        style={{
                            position: 'absolute',
                            top: 24,
                            right: 12,
                        }}
                        variant="outlined"
                        startIcon={<DeleteIcon />}
                        onClick={onDeleteClick}
                    >
                        다시 계산하기
                    </Button>
                    <div
                        style={{ display: 'flex', margin: 12, minHeight: 800 }}
                    >
                        <div style={{ height: 400, margin: 12, width: '25%' }}>
                            <div style={{ textAlign: 'center' }}></div>
                            <Pie
                                data={{
                                    labels: ['적립 포인트', '이외 사용 금액'],
                                    datasets: [
                                        {
                                            data: [
                                                totalPoints,
                                                totalUsed - totalPoints,
                                            ],
                                            backgroundColor: [
                                                'rgba(75, 192, 192, 0.2)',
                                                'rgba(54, 162, 235, 0.2)',
                                            ],
                                        },
                                    ],
                                }}
                                options={{
                                    plugins: {
                                        title: {
                                            display: true,
                                            text: `피킹율: ${percent(
                                                totalPoints / totalUsed
                                            )}`,
                                        },
                                    },
                                }}
                            />
                            <Bar
                                data={{
                                    datasets: [
                                        {
                                            stack: 'aaa',
                                            backgroundColor:
                                                'rgba(75, 192, 192, 0.2)',
                                            borderColor: 'white',
                                            data: transactionsByStore
                                                .slice(0, 5)
                                                .map(
                                                    ({ totalPoints }) =>
                                                        totalPoints
                                                ),
                                            order: 1,
                                        },
                                    ],
                                    labels: transactionsByStore
                                        .slice(0, 5)
                                        .map(({ store }) => store),
                                }}
                                options={{
                                    plugins: {
                                        title: {
                                            display: true,
                                            text: 'TOP 5 적립처',
                                        },
                                        legend: { display: false },
                                    },
                                }}
                            />
                            <Bar
                                data={{
                                    datasets: [
                                        {
                                            stack: 'aaa',
                                            backgroundColor:
                                                'rgba(54, 162, 235, 0.2)',
                                            borderColor: 'white',
                                            data: transactionsByStore
                                                .slice(0, 5)
                                                .map(
                                                    ({ totalUsed }) => totalUsed
                                                ),
                                            order: 2,
                                        },
                                    ],
                                    labels: transactionsByStore
                                        .slice(0, 5)
                                        .map(({ store }) => store),
                                }}
                                options={{
                                    plugins: {
                                        title: {
                                            display: true,
                                            text: 'TOP 5 사용처',
                                        },
                                        legend: { display: false },
                                    },
                                }}
                            />
                        </div>
                        <div style={{ height: 800, flexGrow: 1 }}>
                            <DataGrid
                                rows={transactions}
                                columns={gridCols}
                                disableSelectionOnClick
                                getRowClassName={(params: GridRowParams) => {
                                    if (params.row.매입상태 === '승인취소')
                                        return 'cell-disabled'
                                    else if (
                                        params.row.firstTransactionOfTheDay &&
                                        SPECIAL_STORES.indexOf(
                                            params.row.가맹점명
                                        ) !== -1
                                    )
                                        return 'cell-boosted'
                                    else if (
                                        params.row.firstTransactionOfTheDay
                                    )
                                        return 'cell-success'
                                    else return 'cell-error'
                                }}
                            />
                        </div>
                    </div>
                </>
            )}
            <Divider style={{ marginTop: 24, marginBottom: 24 }} />
            <ul className="disclaimer">
                <li style={{ fontWeight: 'bold' }}>
                    이 페이지는 신한금융그룹 및 신한카드와 아무런 관계가
                    없습니다.
                </li>
                <li style={{ fontWeight: 'bold' }}>
                    이 페이지에서 제공하는 모든 데이터는 법적 효력 및 정확성을
                    담보하지 않습니다.
                </li>
                <li>
                    이 페이지는 GitHub 社의 Pages 기능을 활용하여 제공됩니다.
                </li>
                <li>
                    이 페이지는 GitHub 社의 GitHub Pages가 기본적으로 수집하는
                    데이터 이외의 모든 데이터를 수집하지 않습니다. GitHub 社에서
                    수집하는 데이터에 관한 정보는{' '}
                    <a href="https://docs.github.com/en/github/site-policy/github-privacy-statement">
                        다음 링크
                    </a>
                    를 참고하시기 바랍니다.
                </li>
                <li>
                    이 페이지는 사용자가 THE MORE 카드 적립 패턴 분석을 위해
                    웹사이트에 제공하는 카드 이용 내역 데이터를 기초로 하여
                    작동합니다. 해당 데이터는 사용자가 직접{' '}
                    <a href="https://www.shinhancard.com">신한카드 홈페이지</a>
                    에서 발급받아야 합니다.
                </li>
                <li>
                    이 페이지에서 제공하는 모든 데이터는 최신 기준의 데이터가
                    아닐 수 있습니다.
                </li>
                <li>
                    이 페이지에 사용자가 제공하는 카드 이용 내역 데이터는
                    사용자의 브라우저 내에서만 사용됩니다.{' '}
                </li>
            </ul>
        </div>
    )
}

export default App
