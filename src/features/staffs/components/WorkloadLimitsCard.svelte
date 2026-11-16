<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchWorkloadLimits, updateWorkloadLimits, type WorkloadLimit } from '../api/staffs-api';

	let visaLimit = $state(3);
	let vfsLimit = $state(3);
	let holidayLimit = $state(3);

	let isLoading = $state(true);
	let isSaving = $state(false);
	let successMsg = $state('');
	let errorMsg = $state('');

	async function loadLimits() {
		isLoading = true;
		errorMsg = '';
		try {
			const data: WorkloadLimit[] = await fetchWorkloadLimits();
			for (const item of data) {
				if (!item.userId) {
					const type = item.entityType.toUpperCase();
					if (type.includes('VISA')) visaLimit = item.maxActiveLimit;
					else if (type.includes('VFS')) vfsLimit = item.maxActiveLimit;
					else if (type.includes('HOLIDAY')) holidayLimit = item.maxActiveLimit;
				}
			}
		} catch (err: any) {
			errorMsg = 'Failed to load workload limits from Operational Portal.';
		} finally {
			isLoading = false;
		}
	}

	async function handleSave() {
		isSaving = true;
		successMsg = '';
		errorMsg = '';

		try {
			const limits = [
				{ entityType: 'VISA', maxActiveLimit: Math.max(1, visaLimit) },
				{ entityType: 'VFS', maxActiveLimit: Math.max(1, vfsLimit) },
				{ entityType: 'HOLIDAY', maxActiveLimit: Math.max(1, holidayLimit) }
			];

			await updateWorkloadLimits(limits);
			successMsg = 'Operator workload capacity limits saved successfully!';
			setTimeout(() => (successMsg = ''), 4000);
		} catch (err: any) {
			errorMsg = 'Error updating workload limits: ' + (err?.message || 'Server error');
		} finally {
			isSaving = false;
		}
	}

	onMount(() => {
		loadLimits();
	});
</script>

<div class="workload-card">
	<div class="workload-header">
		<div>
			<h3 class="workload-title">Operator Workload Capacity Limits</h3>
			<p class="workload-sub">Configure maximum active pending applications an operator can claim simultaneously per module type</p>
		</div>
		<button class="btn btn--secondary btn--sm" onclick={loadLimits} disabled={isLoading || isSaving}>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-1">
				<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
			</svg>
			Refresh
		</button>
	</div>

	{#if isLoading}
		<div class="loading-skeleton">Loading capacity limits…</div>
	{:else}
		<div class="limits-grid">
			<div class="limit-box">
				<div class="limit-box__icon visa">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
					</svg>
				</div>
				<div class="limit-box__content">
					<label for="visa-limit-input" class="limit-box__label">Visa Applications Max Active</label>
					<span class="limit-box__hint">Operators can hold up to {visaLimit} active Visas</span>
				</div>
				<div class="limit-box__input-wrap">
					<input
						id="visa-limit-input"
						type="number"
						min="1"
						max="50"
						class="limit-input"
						bind:value={visaLimit}
						aria-label="Visa Applications Max Active Limit"
					/>
				</div>
			</div>

			<div class="limit-box">
				<div class="limit-box__icon vfs">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
					</svg>
				</div>
				<div class="limit-box__content">
					<label for="vfs-limit-input" class="limit-box__label">VFS Appointments Max Active</label>
					<span class="limit-box__hint">Operators can hold up to {vfsLimit} active VFS slots</span>
				</div>
				<div class="limit-box__input-wrap">
					<input
						id="vfs-limit-input"
						type="number"
						min="1"
						max="50"
						class="limit-input"
						bind:value={vfsLimit}
						aria-label="VFS Appointments Max Active Limit"
					/>
				</div>
			</div>

			<div class="limit-box">
				<div class="limit-box__icon holiday">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
					</svg>
				</div>
				<div class="limit-box__content">
					<label for="holiday-limit-input" class="limit-box__label">Holiday Packages Max Active</label>
					<span class="limit-box__hint">Operators can hold up to {holidayLimit} active Holidays</span>
				</div>
				<div class="limit-box__input-wrap">
					<input
						id="holiday-limit-input"
						type="number"
						min="1"
						max="50"
						class="limit-input"
						bind:value={holidayLimit}
						aria-label="Holiday Packages Max Active Limit"
					/>
				</div>
			</div>
		</div>

		{#if successMsg}
			<div class="alert alert--success">{successMsg}</div>
		{/if}

		{#if errorMsg}
			<div class="alert alert--error">{errorMsg}</div>
		{/if}

		<div class="workload-footer">
			<button class="btn btn--primary" onclick={handleSave} disabled={isSaving}>
				{#if isSaving}
					Saving Limits…
				{:else}
					Save Workload Capacity Limits
				{/if}
			</button>
		</div>
	{/if}
</div>

<style>
	.workload-card {
		background: hsl(var(--card, 0 0% 100%));
		border: 1px solid hsl(var(--border, 220 13% 91%));
		border-radius: 1rem;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
	}

	.workload-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	.workload-title {
		font-size: 1.125rem;
		font-weight: 700;
		color: hsl(var(--foreground, 222 47% 11%));
		margin: 0 0 0.25rem;
	}

	.workload-sub {
		font-size: 0.8125rem;
		color: hsl(var(--muted-foreground, 215 16% 47%));
		margin: 0;
	}

	.limits-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	.limit-box {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		background: hsl(var(--muted, 210 40% 96.1%) / 0.5);
		border: 1px solid hsl(var(--border, 220 13% 91%));
		border-radius: 0.75rem;
	}

	.limit-box__icon {
		width: 42px;
		height: 42px;
		border-radius: 0.625rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.limit-box__icon.visa { background: hsl(215 89% 53% / 0.1); color: hsl(215 89% 53%); }
	.limit-box__icon.vfs { background: hsl(270 70% 55% / 0.1); color: hsl(270 70% 55%); }
	.limit-box__icon.holiday { background: hsl(160 84% 39% / 0.1); color: hsl(160 84% 39%); }

	.limit-box__content {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.limit-box__label {
		font-size: 0.875rem;
		font-weight: 600;
		color: hsl(var(--foreground));
	}

	.limit-box__hint {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
	}

	.limit-input {
		width: 70px;
		padding: 0.5rem;
		font-size: 1rem;
		font-weight: 700;
		text-align: center;
		border-radius: 0.5rem;
		border: 1px solid hsl(var(--border));
		background: hsl(var(--background));
		color: hsl(var(--foreground));
	}

	.workload-footer {
		display: flex;
		justify-content: flex-end;
		margin-top: 1rem;
	}

	.alert {
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		margin-top: 1rem;
	}
	.alert--success {
		background: hsl(142 76% 36% / 0.1);
		color: hsl(142 76% 36%);
		border: 1px solid hsl(142 76% 36% / 0.2);
	}
	.alert--error {
		background: hsl(0 84% 60% / 0.1);
		color: hsl(0 84% 60%);
		border: 1px solid hsl(0 84% 60% / 0.2);
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		border: 1px solid transparent;
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
	}
	.btn--primary {
		background: hsl(var(--primary, 222 47% 11%));
		color: hsl(var(--primary-foreground, 210 40% 98%));
	}
	.btn--primary:hover { opacity: 0.9; }
	.btn--secondary {
		background: hsl(var(--muted));
		color: hsl(var(--foreground));
		border-color: hsl(var(--border));
	}
	.mr-1 { margin-right: 0.25rem; }
	.loading-skeleton { padding: 1.5rem; text-align: center; color: hsl(var(--muted-foreground)); }
</style>
