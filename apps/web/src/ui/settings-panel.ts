// 計算の設定パネル（T1.5-05、AC-11）：抗力・マグヌス力・回転減衰を個別に ON/OFF する。重力は常に ON。
// 回転減衰のモデルは、使う係数（P-14・P-22）が未決定のため選べない（選択肢には理由を表示する）。
import type { ParameterSet, SimulationSettings, SpinDecaySelection } from '@kick-dynamics/physics-core';
import { element, section } from './dom';

export function createSettingsPanel(
  initial: SimulationSettings, parameters: ParameterSet, onChange: (settings: SimulationSettings) => void,
): HTMLElement {
  let settings = initial;
  const update = (forces: Partial<SimulationSettings['forces']>): void => {
    settings = { ...settings, forces: { ...settings.forces, ...forces } };
    onChange(settings);
  };
  const checkbox = (label: string, testId: string, checked: boolean, set: (on: boolean) => void): HTMLElement => {
    const input = element('input', { type: 'checkbox', 'data-testid': testId });
    input.checked = checked;
    input.addEventListener('change', () => set(input.checked));
    return element('label', { class: 'check-row' }, input, ` ${label}`);
  };
  const decayOption = (value: SpinDecaySelection, label: string, undetermined: boolean): HTMLOptionElement => {
    const option = element('option', { value }, undetermined ? `${label}（係数が未決定のため選べない）` : label);
    option.disabled = undetermined;
    return option;
  };
  const decay = element('select', { 'data-testid': 'spin-decay' },
    decayOption('none', 'なし', false),
    decayOption('linear', '線形（P-14）', parameters.spinDecayLinear.value === null),
    decayOption('torque-coefficient', 'トルク係数（P-22）', parameters.torqueCoefficient.value === null));
  decay.value = initial.forces.spinDecay;
  decay.addEventListener('change', () => update({ spinDecay: decay.value as SpinDecaySelection }));
  return section('計算の設定',
    element('p', { class: 'hint' }, '力項を個別に ON/OFF できます（重力は常に ON）。すべて OFF のとき、軌道は真空中の放物運動になります。変更は次のキックから反映されます。'),
    checkbox('抗力', 'force-drag', initial.forces.drag, (on) => update({ drag: on })),
    checkbox('マグヌス力', 'force-magnus', initial.forces.magnus, (on) => update({ magnus: on })),
    element('label', { class: 'slider-row' }, element('span', { class: 'slider-label' }, '回転減衰'), decay),
  );
}
