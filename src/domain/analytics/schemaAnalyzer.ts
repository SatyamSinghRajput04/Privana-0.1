export interface ColumnProfile {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date';
    semanticType: string;
    cardinality: number;
    uniquenessRatio: number;
    missingRatio: number;
    isIdLike: boolean;
    isContinuous: boolean;
    isDateLike: boolean;
    filterScore: number;
    metricScore: number;
    groupingScore: number;
}

export const SchemaAnalyzer = {
    analyzeSchema(dataset: any[]): ColumnProfile[] {
        if (!dataset || dataset.length === 0) return [];
        
        const columnNames = Object.keys(dataset[0]);
        const totalRows = dataset.length;
        // Limit scanning to max 5000 rows to avoid UI blocking during introspection
        const scanRows = dataset.slice(0, 5000);
        const scanLength = scanRows.length;
        
        return columnNames.map(colName => {
            const values = scanRows.map(row => row[colName]);
            
            // Calculate missing
            let missingCount = 0;
            for (let i = 0; i < scanLength; i++) {
                const val = values[i];
                if (val === null || val === undefined || val === '') {
                    missingCount++;
                }
            }
            const missingRatio = missingCount / scanLength;
            
            // Collect non-missing values
            const validValues = values.filter(v => v !== null && v !== undefined && v !== '');
            const validCount = validValues.length;
            
            // Distinct values
            const uniqueSet = new Set(validValues);
            const cardinality = uniqueSet.size;
            const uniquenessRatio = validCount > 0 ? cardinality / validCount : 0;
            
            // Infer basic type
            let type: 'string' | 'number' | 'boolean' | 'date' = 'string';
            let isNumeric = false;
            let numericCount = 0;
            
            for (let i = 0; i < validCount; i++) {
                const val = validValues[i];
                if (typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)))) {
                    numericCount++;
                }
            }
            
            if (numericCount > validCount * 0.8) {
                type = 'number';
                isNumeric = true;
            }
            
            // Is ID like? High uniqueness, name includes id
            const lowerName = colName.toLowerCase();
            const isIdLike = uniquenessRatio > 0.9 || lowerName === 'id' || lowerName.endsWith('_id') || lowerName.startsWith('id_');
            
            // Is date like?
            const isDateLike = lowerName.includes('date') || lowerName.includes('time') || lowerName.includes('year') || lowerName.includes('month');
            
            // Is continuous? numeric and cardinality > 10
            const isContinuous = isNumeric && cardinality > 10;
            
            let filterScore = 0;
            let metricScore = 0;
            let groupingScore = 0;
            
            // Filter Score: Best are categorical, low cardinality (2 to 50), not IDs
            if (!isIdLike && !isContinuous && cardinality >= 2 && cardinality <= 100) {
                // Penalize high missing ratio
                filterScore = (1 - missingRatio) * (1 / Math.log10(cardinality + 1)) * 100;
            }
            
            // Metric Score: Best are continuous numerics, not IDs, not dates
            if (isContinuous && !isIdLike && !isDateLike) {
                metricScore = (1 - missingRatio) * 100;
                // Boost typical metric names
                if (lowerName.includes('price') || lowerName.includes('value') || lowerName.includes('score') || lowerName.includes('level') || lowerName.includes('amount') || lowerName.includes('count')) {
                    metricScore += 50;
                }
            }
            
            // Grouping Score: Best are categorical, low to medium cardinality
            if (!isIdLike && !isContinuous && cardinality >= 2 && cardinality <= 200) {
                groupingScore = (1 - missingRatio) * (1 / Math.log10(cardinality + 1)) * 100;
                if (lowerName.includes('category') || lowerName.includes('type') || lowerName.includes('status') || lowerName.includes('group') || lowerName.includes('department') || lowerName.includes('role')) {
                    groupingScore += 50;
                }
            }
            
            return {
                name: colName,
                type,
                semanticType: type,
                cardinality,
                uniquenessRatio,
                missingRatio,
                isIdLike,
                isContinuous,
                isDateLike,
                filterScore,
                metricScore,
                groupingScore
            };
        });
    }
};
