const fs = require('fs');

const sourcePath = 'src/pages/AnalyzePage_test.tsx';
const targetPath = 'src/pages/AnalyzePage.tsx';

if (!fs.existsSync(sourcePath)) {
  console.error(`Source file ${sourcePath} does not exist.`);
  process.exit(1);
}

let content = fs.readFileSync(sourcePath, 'utf8');

// 1. Fix the onClick event bug for handleAskAI
console.log('Replacing onClick={handleAskAI}...');
content = content.replace('onClick={handleAskAI}', 'onClick={() => handleAskAI()}');

// 2. Insert the closing </div> for the Q&A AI Assistant Box container
// In the source file, it has:
//                   </motion.div>
//                 )}
// 
//               {!selectedDataset ? (
//
// We want to replace it with:
//                   </motion.div>
//                 )}
//               </div>
// 
//               {!selectedDataset ? (
console.log('Closing Q&A Box div...');
const qaBoxSearch = `                  </motion.div>
                )}

              {!selectedDataset ? (`;

const qaBoxReplace = `                  </motion.div>
                )}
              </div>

              {!selectedDataset ? (`;

if (content.includes(qaBoxSearch)) {
  content = content.replace(qaBoxSearch, qaBoxReplace);
  console.log('Successfully closed Q&A Box div.');
} else {
  console.error('ERROR: Could not locate Q&A Box close target!');
}

// 3. Wrap the Q&A Box in {selectedDataset && ( ... )}
// The Q&A Box starts with:
//               {/* Q&A AI Assistant Box */}
//               <div style={{
//                 background: 'rgba(20, 10, 12, 0.65)',
//
// We want to replace it with:
//               {/* Q&A AI Assistant Box */}
//               {selectedDataset && (
//                 <div style={{
//                   background: 'rgba(20, 10, 12, 0.65)',
console.log('Wrapping Q&A Box in selectedDataset check...');
const qaStartSearch = `              {/* Q&A AI Assistant Box */}
              <div style={{
                background: 'rgba(20, 10, 12, 0.65)',`;

const qaStartReplace = `              {/* Q&A AI Assistant Box */}
              {selectedDataset && (
                <div style={{
                  background: 'rgba(20, 10, 12, 0.65)',`;

if (content.includes(qaStartSearch)) {
  content = content.replace(qaStartSearch, qaStartReplace);
  
  // Now we need to close the condition right after the Q&A Box container div closes (which we just added).
  // The closed container div is followed by:
  //               {!selectedDataset ? (
  //
  // So we replace:
  //               </div>
  // 
  //               {!selectedDataset ? (
  //
  // with:
  //               </div>
  //               )}
  // 
  //               {!selectedDataset ? (
  const qaEndSearch = `              </div>

              {!selectedDataset ? (`;
  
  const qaEndReplace = `              </div>
              )}

              {!selectedDataset ? (`;
              
  if (content.includes(qaEndSearch)) {
    content = content.replace(qaEndSearch, qaEndReplace);
    console.log('Successfully wrapped Q&A Box.');
  } else {
    console.error('ERROR: Could not locate Q&A Box end wrap target!');
  }
} else {
  console.error('ERROR: Could not locate Q&A Box start wrap target!');
}

// 4. Wrap the Filters Panel in {selectedDataset && ( ... )}
console.log('Wrapping Filters Panel in selectedDataset check...');
const filterStartSearch = `        {/* MIDDLE AREA: FILTERS PANEL (230px wide) */}
        <div style={{
          width: 230,`;

const filterStartReplace = `        {/* MIDDLE AREA: FILTERS PANEL (230px wide) */}
        {selectedDataset && (
          <div style={{
            width: 230,`;

if (content.includes(filterStartSearch)) {
  content = content.replace(filterStartSearch, filterStartReplace);
  
  const filterEndSearch = `          </div>
        </div>

        {/* RIGHT AREA: FIELDS PANEL (230px wide) */}`;
  
  const filterEndReplace = `          </div>
        </div>
        )}

        {/* RIGHT AREA: FIELDS PANEL (230px wide) */}`;
        
  if (content.includes(filterEndSearch)) {
    content = content.replace(filterEndSearch, filterEndReplace);
    console.log('Successfully wrapped Filters Panel.');
  } else {
    console.error('ERROR: Could not locate Filters Panel end wrap target!');
  }
} else {
  console.error('ERROR: Could not locate Filters Panel start wrap target!');
}

// 5. Wrap the Fields Panel in {selectedDataset && ( ... )}
console.log('Wrapping Fields Panel in selectedDataset check...');
const fieldsStartSearch = `        {/* RIGHT AREA: FIELDS PANEL (230px wide) */}
        <div style={{
          width: 230,`;

const fieldsStartReplace = `        {/* RIGHT AREA: FIELDS PANEL (230px wide) */}
        {selectedDataset && (
          <div style={{
            width: 230,`;

if (content.includes(fieldsStartSearch)) {
  content = content.replace(fieldsStartSearch, fieldsStartReplace);
  
  const fieldsEndSearch = `          </div>
        </div>

      </div>

      {/* Floating AI Chat Assistant Trigger Button */}`;

  const fieldsEndReplace = `          </div>
        </div>
        )}

      </div>

      {/* Floating AI Chat Assistant Trigger Button */}`;

  if (content.includes(fieldsEndSearch)) {
    content = content.replace(fieldsEndSearch, fieldsEndReplace);
    console.log('Successfully wrapped Fields Panel.');
  } else {
    console.error('ERROR: Could not locate Fields Panel end wrap target!');
  }
} else {
  console.error('ERROR: Could not locate Fields Panel start wrap target!');
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log(`Saved clean repaired and updated file to ${targetPath}`);
