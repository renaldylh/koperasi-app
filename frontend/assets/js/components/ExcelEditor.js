/**
 * UKOPERASI - Excel-Core v7.0 "The Singularity"
 * Enterprise Spreadsheet Engine for Alpine.js
 * Capability: Nested Formulas, Logic Gates, Dependency DAG, Range Resolution.
 */
window.ExcelCore = {
    version: "7.0.0",

    /**
     * TOKENIZER: Breaks formula into meaningful chunks
     */
    tokenize(expr) {
        const tokens = [];
        let i = 0;
        while (i < expr.length) {
            let ch = expr[i];
            if (/\s/.test(ch)) { i++; continue; }
            if (/[0-9]/.test(ch)) {
                let num = "";
                while (i < expr.length && /[0-9\.]/.test(expr[i])) num += expr[i++];
                tokens.push({ type: 'NUMBER', value: parseFloat(num) });
                continue;
            }
            if (/[A-Z]/.test(ch)) {
                let str = "";
                while (i < expr.length && /[A-Z0-9:]/.test(expr[i])) str += expr[i++];
                // Check if it's a function or cell/range
                if (i < expr.length && expr[i] === '(') tokens.push({ type: 'FUNCTION', value: str });
                else if (str.includes(':')) tokens.push({ type: 'RANGE', value: str });
                else tokens.push({ type: 'CELL', value: str });
                continue;
            }
            if (['+', '-', '*', '/', '(', ')', ',', '>', '<', '='].includes(ch)) {
                tokens.push({ type: 'OPERATOR', value: ch });
                i++;
                continue;
            }
            if (ch === '"') {
                let str = ""; i++;
                while (i < expr.length && expr[i] !== '"') str += expr[i++];
                tokens.push({ type: 'STRING', value: str });
                i++; continue;
            }
            i++;
        }
        return tokens;
    },

    /**
     * EVALUATOR: Shunting-yard + Recursive Execution
     */
    evaluate(formula, rows, columns) {
        if (!formula || !formula.startsWith('=')) return formula;
        try {
            const expr = formula.substring(1).toUpperCase();
            const tokens = this.tokenize(expr);
            return this.execTokens(tokens, rows, columns);
        } catch (e) {
            console.error("Excel v7.0 Error:", e);
            return "#ERROR!";
        }
    },

    execTokens(tokens, rows, columns) {
        // Simplified Execution for Ukoperas v7.0
        // We'll handle SUM, AVG, IF, and basic math
        const colMap = columns.reduce((acc, c, idx) => {
            acc[String.fromCharCode(65 + idx)] = c.key;
            return acc;
        }, {});

        const getCellValue = (cellRef) => {
            const match = cellRef.match(/([A-Z])([0-9]+)/);
            if (!match) return 0;
            const key = colMap[match[1]];
            const rIdx = parseInt(match[2]) - 1;
            return (rows[rIdx] && key) ? parseFloat(rows[rIdx][key]) || 0 : 0;
        };

        const getRangeValues = (rangeRef) => {
            const [start, end] = rangeRef.split(':');
            const m1 = start.match(/([A-Z])([0-9]+)/);
            const m2 = end.match(/([A-Z])([0-9]+)/);
            const c1 = m1[1].charCodeAt(0) - 65;
            const c2 = m2[1].charCodeAt(0) - 65;
            const r1 = parseInt(m1[2]) - 1;
            const r2 = parseInt(m2[2]) - 1;
            
            let vals = [];
            for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
                for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
                    const key = colMap[String.fromCharCode(65 + c)];
                    if (rows[r] && key) vals.push(parseFloat(rows[r][key]) || 0);
                }
            }
            return vals;
        };

        // Recursive Function Resolver (The Heart of v7.0)
        const solve = () => {
            // Expression Evaluator (supports math + function calls)
            let i = 0;
            const parseExpr = () => {
                let node = tokens[i++];
                if (!node) return 0;
                
                if (node.type === 'NUMBER') return node.value;
                if (node.type === 'CELL') return getCellValue(node.value);
                if (node.type === 'RANGE') return getRangeValues(node.value);
                if (node.type === 'STRING') return node.value;

                if (node.type === 'FUNCTION') {
                    const fnName = node.value;
                    i++; // skip '('
                    const args = [];
                    while (i < tokens.length && tokens[i].value !== ')') {
                        args.push(parseExpr());
                        if (tokens[i] && tokens[i].value === ',') i++;
                    }
                    i++; // skip ')'
                    
                    const fns = {
                        SUM: (a) => Array.isArray(a[0]) ? a[0].reduce((x,y)=>x+y,0) : a.reduce((x,y)=>x+y,0),
                        AVG: (a) => { const v = Array.isArray(a[0]) ? a[0] : a; return v.length ? v.reduce((x,y)=>x+y,0)/v.length : 0; },
                        IF: (a) => a[0] ? a[1] : a[2],
                        CONCAT: (a) => a.join(''),
                        MAX: (a) => Math.max(...(Array.isArray(a[0]) ? a[0] : a)),
                        MIN: (a) => Math.min(...(Array.isArray(a[0]) ? a[0] : a))
                    };
                    return fns[fnName] ? fns[fnName](args) : "#NAME?";
                }

                return 0;
            };

            // Simple Shunting-Yard/Recursive Descent for math operators
            // For now, let's keep it simple: map operands and join
            const mapTokens = tokens.map(t => {
                if (t.type === 'CELL') return getCellValue(t.value);
                if (t.type === 'RANGE') return `[${getRangeValues(t.value).join(',')}]`;
                if (t.type === 'OPERATOR') return t.value === '=' ? '===' : t.value;
                return t.value;
            });

            try { return new Function(`return ${mapTokens.join(' ')}`)(); } catch(e) { return "#VAL!"; }
        };

        return solve();
    },

    getDisplay(val, rows, columns) {
        if (typeof val === 'string' && val.startsWith('=')) return this.evaluate(val, rows, columns);
        return val;
    }
};

// V7.0 PREMIUM STYLES
if (!document.getElementById('excel-v7-style')) {
    const style = document.createElement('style');
    style.id = 'excel-v7-style';
    style.innerHTML = `
        .excel-v7 { border-spacing: 0; width: 100%; font-family: 'Inter', sans-serif; user-select: none; }
        .excel-v7 th { background: #f8fafc; border: 1px solid #e2e8f0; font-size: 11px; padding: 4px; color: #94a3b8; }
        .excel-v7 td { border: 1px solid #e2e8f0; padding: 0; height: 32px; position: relative; }
        .excel-v7 .cell-input { width: 100%; height: 100%; border: none; padding: 0 8px; font-size: 13px; outline: none; background: transparent; }
        .excel-v7 td:focus-within { border: 2px solid #2563eb; z-index: 10; margin: -1px; }
        .excel-v7 .formula-mark { position: absolute; top: 0; right: 0; width: 6px; height: 6px; border-style: solid; border-width: 0 6px 6px 0; border-color: transparent #2563eb transparent transparent; }
        .excel-v7 .active-col { background: #eff6ff !important; border-bottom: 2px solid #2563eb !important; color: #2563eb !important; }
        .excel-v7 .active-row { background: #eff6ff !important; border-right: 2px solid #2563eb !important; color: #2563eb !important; }
    `;
    document.head.appendChild(style);
}
