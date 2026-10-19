// KickDynamics Lab の起動（T1.4-01）。
import './style.css';
import { createSceneView } from './render/scene-view';

const viewport = document.querySelector<HTMLElement>('#viewport');
if (!viewport) throw new Error('#viewport element is missing');
createSceneView(viewport);
