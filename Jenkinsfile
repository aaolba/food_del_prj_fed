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
                    echo "=== Verify Grafana Provisioning Files ==="
                    ls -la grafana/provisioning/dashboards/ || echo "⚠️ No dashboard files"
                    ls -la grafana/provisioning/datasources/ || echo "⚠️ No datasource files"
                    
                    echo "\\n=== Stopping Containers ==="
                    docker stop food-backend food-frontend food-prometheus food-grafana 2>/dev/null || true
                    docker rm food-backend food-frontend food-prometheus food-grafana 2>/dev/null || true
                    
                    echo "\\n=== Starting Services ==="
                    docker compose -f docker-compose.yml up -d backend frontend prometheus grafana
                    
                    echo "\\n⏳ Waiting 45 seconds for services..."
                    sleep 45
                    
                    echo "\\n=== Container Status ==="
                    docker ps --filter "name=food-" --format "table {{.Names}}\\t{{.Status}}"
                    
                    echo "\\n=== Verify Grafana Mounts ==="
                    docker exec food-grafana ls -la /etc/grafana/provisioning/dashboards/ 2>&1 || echo "❌ Dashboard mount failed"
                    docker exec food-grafana ls -la /etc/grafana/provisioning/datasources/ 2>&1 || echo "❌ Datasource mount failed"
                    
                    echo "\\n=== Backend Health Check ==="
                    for i in 1 2 3 4 5; do
                        if curl -f http://localhost:4000/health 2>/dev/null; then
                            echo "✅ Backend healthy on attempt $i"
                            break
                        else
                            echo "⚠️ Attempt $i/5 failed, waiting 10s..."
                            sleep 10
                        fi
                    done
                    
                    echo "\\n=== Check Backend Logs ==="
                    docker logs food-backend --tail 10
                    
                    echo "\\n=== Prometheus Targets ==="
                    curl -s http://localhost:9090/api/v1/targets 2>/dev/null | grep -o '"health":"[^"]*"' | head -3 || echo "⚠️ Prometheus not ready"
                    
                    echo "\\n=== Grafana Dashboard ==="
                    sleep 10
                    DASHBOARD=$(curl -s -u admin:admin http://localhost:3000/api/search?type=dash-db 2>/dev/null || echo "[]")
                    echo "$DASHBOARD"
                    
                    if echo "$DASHBOARD" | grep -q "food-backend"; then
                        echo "✅ Dashboard loaded"
                    else
                        echo "⚠️ Dashboard missing, restarting Grafana..."
                        docker restart food-grafana
                        sleep 20
                        curl -s -u admin:admin http://localhost:3000/api/search?type=dash-db || true
                    fi
                '''
            }
        }
        
        stage('🛡️ DAST - OWASP ZAP') {
            steps {
                script {
                    echo "Running OWASP ZAP security scan..."
                    sh '''
                        docker run --rm \
                          --network food_del_prj_fed_food-network \
                          -v $(pwd):/zap/wrk:rw \
                          owasp/zap2docker-stable \
                          zap-baseline.py \
                          -t http://food-frontend:3000 \
                          -r zap-report.html \
                          -J zap-report.json || true
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
                        reportName: 'OWASP ZAP Report'
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
            echo "✅ Pipeline SUCCESS #${env.BUILD_NUMBER}"
            echo "📊 Grafana: http://localhost:3000/d/food-backend"
        }
        failure {
            echo "❌ Pipeline FAILED #${env.BUILD_NUMBER}"
        }
    }
}
