import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import "../styles/tailwind.css";

const container = document.getElementById('wp-rescuemode-ai-admin-root');

if (container) {
	const root = createRoot(container);
	root.render(
		<React.StrictMode>
			<App />
		</React.StrictMode>
	);
} else {
	console.error('WP RescueMode AI: Root element #wp-rescuemode-ai-admin-root not found');
}
