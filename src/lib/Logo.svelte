<script lang="ts">
	let { class: className = '' } = $props();
</script>

<!-- Emblem: crystal tower silhouette (overhanging pergola, balcony-zipper shaft,
     flared podium) in white on the app-blue disc -->
<svg class={className} viewBox="0 0 32 32" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
	<circle cx="16" cy="16" r="16" fill="var(--status-planned, #2a78d6)" />
	<g fill="#ffffff" transform="translate(4 4) scale(0.75)">
		<rect x="9.5" y="2" width="13" height="1.5" />
		<rect x="11" y="3.5" width="10" height="20.5" />
		<rect x="9" y="5.5" width="2" height="1.5" />
		<rect x="9" y="9.5" width="2" height="1.5" />
		<rect x="9" y="13.5" width="2" height="1.5" />
		<rect x="9" y="17.5" width="2" height="1.5" />
		<rect x="9" y="21.5" width="2" height="1.5" />
		<rect x="21" y="7.5" width="2" height="1.5" />
		<rect x="21" y="11.5" width="2" height="1.5" />
		<rect x="21" y="15.5" width="2" height="1.5" />
		<rect x="21" y="19.5" width="2" height="1.5" />
		<polygon points="10,24 22,24 25.5,26 6.5,26" />
		<rect x="7" y="26" width="18" height="3" />
		<rect x="5" y="29.5" width="22" height="1" />
	</g>
</svg>
