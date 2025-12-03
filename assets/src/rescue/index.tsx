import React from 'react';
import { createRoot } from 'react-dom/client';
import RescueApp from './App';
import "../styles/tailwind.css";

const container = document.getElementById('wprai-rescue-root');

if (container) {
	const root = createRoot(container);
	root.render(
		<React.StrictMode>
			<RescueApp />
		</React.StrictMode>
	);
} else {
	console.error('WP RescueMode AI: Root element #wprai-rescue-root not found');
}
