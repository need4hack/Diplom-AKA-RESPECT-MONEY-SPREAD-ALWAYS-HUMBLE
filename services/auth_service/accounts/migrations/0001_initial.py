from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='User',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('username', models.CharField(max_length=50, unique=True)),
                ('email', models.CharField(max_length=100, unique=True)),
                ('password_hash', models.TextField()),
                ('role', models.CharField(default='user', max_length=20)),
                ('api_key', models.CharField(blank=True, max_length=64, null=True)),
                ('request_limit', models.IntegerField(default=1000)),
                ('request_count', models.IntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'User',
                'verbose_name_plural': 'Users',
                'db_table': 'users',
                'ordering': ['-created_at'],
                'managed': False,
            },
        ),
        migrations.CreateModel(
            name='Report',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('vin', models.CharField(max_length=17)),
                ('vehicle_id', models.IntegerField()),
                ('year', models.IntegerField()),
                ('make', models.CharField(max_length=100)),
                ('model', models.CharField(max_length=100)),
                ('trim', models.CharField(blank=True, default='', max_length=150)),
                ('mileage', models.IntegerField(default=0)),
                ('is_new', models.BooleanField(default=False)),
                ('damage_count', models.IntegerField(default=0)),
                ('today_price', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('new_price', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('high', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('medium', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('low', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('vehicle_snapshot', models.JSONField(blank=True, default=dict)),
                ('damage_selections', models.JSONField(blank=True, default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(db_column='user_id', on_delete=django.db.models.deletion.CASCADE, related_name='reports', to='accounts.user')),
            ],
            options={
                'verbose_name': 'Report',
                'verbose_name_plural': 'Reports',
                'db_table': 'reports',
                'ordering': ['-created_at'],
            },
        ),
    ]
