document.addEventListener('DOMContentLoaded', function() {
  // Initialize Materialize Select Dropdown
  const elems = document.querySelectorAll('select');
  M.FormSelect.init(elems);

  const canvas = document.getElementById('starlingCanvas');
  const ctx = canvas.getContext('2d');
  
  // DOM Elements
  const inputEDV = document.getElementById('input-edv');
  const inputMAP = document.getElementById('input-map');
  const inputInotropy = document.getElementById('input-inotropy');
  const inputHeight = document.getElementById('input-height');
  const inputWeight = document.getElementById('input-weight');
  
  const dispEDV = document.getElementById('disp-edv');
  const dispMAP = document.getElementById('disp-map');
  
  const valSVI = document.getElementById('val-svi');
  const valCI = document.getElementById('val-ci');
  const valEF = document.getElementById('val-ef');
  const valBSA = document.getElementById('val-bsa');
  const hintEDV = document.getElementById('hint-edv');

  // Mathematical Parameters for the raw Stroke Volume curves
  const curveParams = {
    increased: { vmax: 180, km: 60, color: '#a5d6a7', activeColor: '#2e7d32', label: 'Increased Inotropy' },
    normal:    { vmax: 145, km: 70, color: '#90caf9', activeColor: '#1a73e8', label: 'Normal State' },
    decreased: { vmax: 100, km: 100, color: '#e0e0e0', activeColor: '#374151', label: 'Heart Failure' }
  };

  const fixedHR = 73;

  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    updateSimulation();
  }

  window.addEventListener('resize', resizeCanvas);

  function calculateRawSV(edv, map, state) {
    const params = curveParams[state];
    let sv = (params.vmax * edv) / (params.km + edv);
    
    // Afterload Modifer
    const afterloadSensitivity = state === 'decreased' ? 0.002 : 0.001;
    const mapModifier = 1 - (map - 60) * afterloadSensitivity;
    
    sv = sv * mapModifier;
    return Math.max(0, sv);
  }

  function updateSimulation() {
    const edv = parseFloat(inputEDV.value);
    const map = parseFloat(inputMAP.value);
    const height = parseFloat(inputHeight.value) || 170;
    const weight = parseFloat(inputWeight.value) || 70;
    const state = inputInotropy.value;

    // Body Surface Area (Mosteller Formula)
    const bsa = Math.sqrt((height * weight) / 3600);

    // Dynamically update the visual trailing fill for both sliders
    [inputEDV, inputMAP].forEach(input => {
      const min = parseFloat(input.min) || 0;
      const max = parseFloat(input.max) || 100;
      const val = parseFloat(input.value);
      const percentage = ((val - min) / (max - min)) * 100;
      input.style.setProperty('--progress', `${percentage}%`);
    });

    dispEDV.textContent = Math.round(edv);
    dispMAP.textContent = Math.round(map);

    // Compute Raw Metrics
    const svRaw = calculateRawSV(edv, map, state);
    const coRaw = (svRaw * fixedHR) / 1000;
    const ef = (svRaw / edv) * 100;

    // Compute Indexed Metrics
    const svi = svRaw / bsa;
    const ci = coRaw / bsa;

    // Update Display Cards
    valSVI.textContent = svi.toFixed(1);
    valCI.textContent = ci.toFixed(1);
    valEF.textContent = Math.min(Math.round(ef), 100);
    valBSA.textContent = bsa.toFixed(2);
    
    // Update Dynamic Normal Range for Preload (Target EDVI 60-100 mL/m²)
    const edvMin = Math.round(60 * bsa);
    const edvMax = Math.round(100 * bsa);
    hintEDV.textContent = `Normal: ${edvMin}–${edvMax} mL (BSA Indexed)`;

    drawGraph(edv, svi, state, map, bsa);
  }

  function drawGraph(activeEDV, activeSVI, activeState, currentMAP, bsa) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    
    const marginLeft = 45;
    const marginBottom = 24;
    const plotWidth = width - marginLeft - 10;
    const plotHeight = height - marginBottom - 10;

    // SVI Scale Adjustments
    const maxX = 260; // Max EDV
    const maxYSVI = 100; // Max SVI (mL/m²)
    
    const mapX = (val) => marginLeft + (val / maxX) * plotWidth;
    const mapY = (val) => (height - marginBottom) - (val / maxYSVI) * plotHeight;

    ctx.clearRect(0, 0, width, height);

    // 1. Draw Background Grid & Labels
    ctx.strokeStyle = '#e8eaed';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // X-Axis Grid & Numbers (EDV)
    for (let x = 50; x <= 250; x += 50) {
      const px = mapX(x);
      ctx.beginPath();
      ctx.moveTo(px, 10);
      ctx.lineTo(px, height - marginBottom);
      ctx.stroke();
      
      ctx.fillStyle = '#5f6368';
      ctx.font = '13px "Google Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(x, px, height - 6);
    }

    // Y-Axis Grid & Numbers (SVI)
    for (let y = 20; y <= 100; y += 20) {
      const py = mapY(y);
      ctx.beginPath();
      ctx.moveTo(marginLeft, py);
      ctx.lineTo(width, py);
      ctx.stroke();
      
      ctx.fillStyle = '#5f6368';
      ctx.font = '13px "Google Sans", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(y, marginLeft - 8, py + 4);
    }

    // Draw Primary Axis Baseline Lines
    ctx.setLineDash([]);
    ctx.strokeStyle = '#9aa0a6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(marginLeft, 10);
    ctx.lineTo(marginLeft, height - marginBottom);
    ctx.lineTo(width, height - marginBottom);
    ctx.stroke();

    // 2. Draw Indexed Curves
    Object.keys(curveParams).forEach(key => {
      const isActive = key === activeState;
      const params = curveParams[key];
      
      ctx.beginPath();
      ctx.strokeStyle = isActive ? params.activeColor : params.color;
      ctx.lineWidth = isActive ? 3 : 2;
      ctx.setLineDash(isActive ? [] : [4, 4]);

      // Apply the afterload modifier globally to the background curves
      const afterloadSensitivity = key === 'decreased' ? 0.002 : 0.001;
      const mapModifier = 1 - (currentMAP - 60) * afterloadSensitivity;

      for (let x = 20; x <= 240; x += 4) {
        const rawSV = (params.vmax * x) / (params.km + x);
        const indexedSVI = (rawSV * mapModifier) / bsa;
        
        const px = mapX(x);
        const py = mapY(indexedSVI);
        
        if (x === 20) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Label at tail of curve
      const labelX = mapX(238);
      const rawLabelSV = (params.vmax * 238) / (params.km + 238);
      const labelY = mapY((rawLabelSV * mapModifier) / bsa);
      
      ctx.fillStyle = isActive ? params.activeColor : '#9aa0a6';
      ctx.textAlign = 'right';
      ctx.font = isActive ? 'bold 13px "Google Sans", sans-serif' : '12px "Google Sans", sans-serif';
      ctx.fillText(params.label, labelX, labelY - 10);
    });

    // 3. Draw Active Patient Indicator
    const px = mapX(activeEDV);
    const py = mapY(activeSVI);

    // Dotted Drop Lines
    ctx.strokeStyle = '#d93025';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, height - marginBottom);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(marginLeft, py);
    ctx.lineTo(px, py);
    ctx.stroke();

    // Active Indicator Dot
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#d93025';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }

  // Event Listeners
  inputEDV.addEventListener('input', updateSimulation);
  inputMAP.addEventListener('input', updateSimulation);
  inputInotropy.addEventListener('change', updateSimulation);
  inputHeight.addEventListener('input', updateSimulation);
  inputWeight.addEventListener('input', updateSimulation);

  setTimeout(resizeCanvas, 80);
});