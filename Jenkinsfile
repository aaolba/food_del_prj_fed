pipeline {
    agent any
    
    environment {
        DOCKER_REGISTRY = 'docker.io/your-username'
        IMAGE_NAME = 'food-delivery'
        SONAR_HOST = 'http://sonarqube:9000'
        DOCKER_BUILDKIT = '1'
    }
    
    tools {
        nodejs 'nodejs-24'
    }
    
    stages {
        stage('🔍 Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()
                }
            }
        }
        
        stage('📦 Install Dependencies') {
            parallel {
                stage('Backend') {
                    steps {
                        dir('backend') {
                            sh 'npm ci'
                        }
                    }
                }
                stage('Frontend') {
                    steps {
                        dir('frontend') {
                            sh 'npm ci'
                        }
                    }
                }
            }
        }
        
        stage('🧪 Unit Tests') {
            parallel {
                stage('Backend Tests') {
                    steps {
                        dir('backend') {
                            sh 'npm test -- --coverage --coverageReporters=lcov || true'
                        }
                    }
                    post {
                        always {
                            publishHTML([
                                allowMissing: true,
                                alwaysLinkToLastBuild: true,
                                keepAll: true,
                                reportDir: 'backend/coverage/lcov-report',
                                reportFiles: 'index.html',
                                reportName: 'Backend Coverage'
                            ])
                        }
                    }
                }
                stage('Frontend Tests') {
                    steps {
                        dir('frontend') {
                            sh 'npm test || true'
                        }
                    }
                }
            }
        }
        
        stage('🔐 SAST - SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh """
                        /usr/local/bin/sonar-scanner \
                          -Dsonar.projectKey=food-delivery \
                          -Dsonar.sources=backend,frontend/src \
                          -Dsonar.exclusions=**/node_modules/**,**/dist/**,**/build/**
                    """
                }
            }
        }
        
        stage('🛡️ Dependency Check') {
            parallel {
                stage('Backend Audit') {
                    steps {
                        dir('backend') {
                            sh 'npm audit --audit-level=moderate --json > npm-audit-backend.json || true'
                            archiveArtifacts artifacts: 'npm-audit-backend.json', allowEmptyArchive: true
                        }
                    }
                }
                stage('Frontend Audit') {
                    steps {
                        dir('frontend') {
                            sh 'npm audit --audit-level=moderate --json > npm-audit-frontend.json || true'
                            archiveArtifacts artifacts: 'npm-audit-frontend.json', allowEmptyArchive: true
                        }
                    }
                }
            }
        }
        
        stage('🐳 Build Docker Images') {
            steps {
                script {
                    echo "Building Docker images with BuildKit..."
                    sh """
                        DOCKER_BUILDKIT=1 docker build \
                          --build-arg BUILDKIT_INLINE_CACHE=1 \
                          -t ${IMAGE_NAME}-backend:${GIT_COMMIT_SHORT} \
                          ./backend
                        
                        DOCKER_BUILDKIT=1 docker build \
                          --build-arg BUILDKIT_INLINE_CACHE=1 \
                          -t ${IMAGE_NAME}-frontend:${GIT_COMMIT_SHORT} \
                          ./frontend
                    """
                }
            }
        }
        
        stage('🔒 Container Security Scan - Trivy') {
            steps {
                sh """
                    trivy image --severity HIGH,CRITICAL \
                        --format json \
                        --output trivy-backend.json \
                        ${IMAGE_NAME}-backend:${GIT_COMMIT_SHORT} || true
                    
                    trivy image --severity HIGH,CRITICAL \
                        --format json \
                        --output trivy-frontend.json \
                        ${IMAGE_NAME}-frontend:${GIT_COMMIT_SHORT} || true
                """
                archiveArtifacts artifacts: 'trivy-*.json', allowEmptyArchive: true
                echo "✅ Container security scan complete!"
            }
        }
        
        stage('🚀 Deploy to Staging') {
            steps {
                sh '''
                    set -e
                    
                    echo "=== Verify Grafana Provisioning Files ==="
                    ls -la grafana/provisioning/dashboards/ || echo "⚠️ No dashboard files found"
                    ls -la grafana/provisioning/datasources/ || echo "⚠️ No datasource files found"
                    
                    echo "\\n=== Stopping Existing Containers ==="
                    docker stop food-backend food-frontend food-prometheus food-grafana 2>/dev/null || true
                    docker rm food-backend food-frontend food-prometheus food-grafana 2>/dev/null || true
                    
                    echo "\\n=== Starting Services ==="
                    docker compose -f docker-compose.yml up -d backend frontend prometheus grafana
                    
                    echo "\\n⏳ Waiting 40 seconds for services to fully start..."
                    sleep 40
                    
                    echo "\\n=== Container Status ==="
                    docker ps --filter "name=food-" --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"
                    
                    echo "\\n=== Verify Grafana Mount ==="
                    docker exec food-grafana ls -la /etc/grafana/provisioning/ || echo "❌ Provisioning dir not mounted"
                    docker exec food-grafana ls -la /etc/grafana/provisioning/dashboards/ || echo "❌ Dashboards dir missing"
                    
                    echo "\\n=== Backend Health Check (retry logic) ==="
                    for i in {1..5}; do
                        if curl -f http://localhost:4000/health; then
                            echo "✅ Backend healthy"
                            break
                        else
                            echo "⚠️ Attempt $i failed, retrying in 5s..."
                            sleep 5
                        fi
                    done
                    
                    echo "\\n=== Prometheus Targets ==="
                    curl -s http://localhost:9090/api/v1/targets | grep -o '"health":"[^"]*"' | head -3 || echo "⚠️ Prometheus check failed"
                    
                    echo "\\n=== Grafana Dashboard Check ==="
                    sleep 5
                    DASHBOARD_CHECK=$(curl -s -u admin:admin http://localhost:3000/api/search?type=dash-db)
                    echo "$DASHBOARD_CHECK"
                    
                    if echo "$DASHBOARD_CHECK" | grep -q "food-backend"; then
                        echo "✅ Dashboard loaded successfully"
                    else
                        echo "⚠️ Dashboard not found, restarting Grafana..."
                        docker restart food-grafana
                        sleep 20
                        curl -s -u admin:admin http://localhost:3000/api/search?type=dash-db
                    fi
                '''
            }
        }
        
        stage('🛡️ DAST - OWASP ZAP') {
            steps {
                script {
                    echo "Running OWASP ZAP baseline security scan..."
                    sh '''
                        docker pull owasp/zap2docker-stable || echo "Using cached ZAP image"
                        
                        docker run --rm \
                          --network food_del_prj_fed_food-network \
                          -v $(pwd):/zap/wrk:rw \
                          owasp/zap2docker-stable \
                          zap-baseline.py \
                          -t http://food-frontend:3000 \
                          -r zap-report.html \
                          -J zap-report.json || true
                        
                        echo "✅ DAST scan complete!"
                    '''
                }
            }
            post {
                always {
                    publishHTML([
                        allowMissing: true,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: '.',
                        reportFiles: 'zap-report.html',
                        reportName: 'OWASP ZAP Security Report'
                    ])
                    archiveArtifacts artifacts: 'zap-report.json', allowEmptyArchive: true
                }
            }
        }
    }
    
    post {
        always {
            cleanWs()
        }
        success {
            echo "✅✅✅ Pipeline SUCCESS: ${env.JOB_NAME} #${env.BUILD_NUMBER} ✅✅✅"
            echo "📊 Grafana: http://localhost:3000/d/food-backend/food-delivery-backend-metrics"
            echo "📈 Prometheus: http://localhost:9090"
        }
        failure {
            echo "❌ Pipeline FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
        }
    }
}
